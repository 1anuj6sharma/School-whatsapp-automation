import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_template_management(client: AsyncClient):
    # 1. Create ACTIVE template
    tpl1 = await client.post("/api/templates", json={
        "name": "hello_world",
        "category": "UTILITY",
        "language": "en_US",
        "status": "ACTIVE",
        "description": "Meta default hello_world template"
    })
    assert tpl1.status_code == 201
    assert tpl1.json()["status"] == "ACTIVE"

    # 2. Create PENDING template
    tpl2 = await client.post("/api/templates", json={
        "name": "student_attendance",
        "category": "UTILITY",
        "language": "en_US",
        "status": "PENDING",
        "description": "Student Attendance Notification Template"
    })
    assert tpl2.status_code == 201
    assert tpl2.json()["status"] == "PENDING"

    # 3. List templates
    list_resp = await client.get("/api/templates")
    assert list_resp.status_code == 200
    templates = list_resp.json()
    assert len(templates) >= 2

    # 4. Duplicate name should fail
    dup_resp = await client.post("/api/templates", json={
        "name": "hello_world",
        "category": "UTILITY",
        "status": "ACTIVE"
    })
    assert dup_resp.status_code == 400
