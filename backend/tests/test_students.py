import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_student_crud_and_opt_in(client: AsyncClient):
    # 1. Create a class first
    cls_resp = await client.post("/api/classes", json={"name": "Class 10-A", "section": "A"})
    assert cls_resp.status_code == 201
    class_id = cls_resp.json()["id"]

    # 2. Create student 1 (opted in)
    st1_resp = await client.post("/api/students", json={
        "class_id": class_id,
        "student_name": "Rahul Sharma",
        "parent_name": "Rahul's Parent",
        "whatsapp_number": "919876543210",
        "whatsapp_opt_in": True
    })
    assert st1_resp.status_code == 201
    st1_data = st1_resp.json()
    assert st1_data["student_name"] == "Rahul Sharma"
    assert st1_data["whatsapp_number"] == "919876543210"
    assert st1_data["whatsapp_opt_in"] is True

    # 3. Create student 2 (opted out)
    st2_resp = await client.post("/api/students", json={
        "class_id": class_id,
        "student_name": "Priya Sharma",
        "parent_name": "Priya's Parent",
        "whatsapp_number": "+91-98765-43211", # check formatting sanitization
        "whatsapp_opt_in": False
    })
    assert st2_resp.status_code == 201
    st2_data = st2_resp.json()
    assert st2_data["whatsapp_number"] == "919876543211"
    assert st2_data["whatsapp_opt_in"] is False

    # 4. List all students in class
    list_resp = await client.get(f"/api/students?class_id={class_id}")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 2

    # 5. Filter by opt_in=true
    opt_in_resp = await client.get(f"/api/students?class_id={class_id}&opt_in=true")
    assert opt_in_resp.status_code == 200
    opt_in_list = opt_in_resp.json()
    assert len(opt_in_list) == 1
    assert opt_in_list[0]["student_name"] == "Rahul Sharma"

    # 6. Filter by search
    search_resp = await client.get("/api/students?search=Priya")
    assert search_resp.status_code == 200
    assert len(search_resp.json()) == 1
    assert search_resp.json()[0]["student_name"] == "Priya Sharma"

    # 7. Invalid phone validation test
    invalid_resp = await client.post("/api/students", json={
        "class_id": class_id,
        "student_name": "Invalid Phone Student",
        "whatsapp_number": "123", # Too short
        "whatsapp_opt_in": True
    })
    assert invalid_resp.status_code == 422
