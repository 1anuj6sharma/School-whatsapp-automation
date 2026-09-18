import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_and_list_classes(client: AsyncClient):
    # Create class
    create_resp = await client.post("/api/classes", json={"name": "Class 10-A", "section": "A"})
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["name"] == "Class 10-A"
    assert created_data["section"] == "A"
    class_id = created_data["id"]

    # List classes
    list_resp = await client.get("/api/classes")
    assert list_resp.status_code == 200
    classes = list_resp.json()
    assert len(classes) >= 1
    assert any(c["id"] == class_id for c in classes)

    # Get single class
    get_resp = await client.get(f"/api/classes/{class_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Class 10-A"

    # Update class
    put_resp = await client.put(f"/api/classes/{class_id}", json={"name": "Class 10-B", "section": "B"})
    assert put_resp.status_code == 200
    assert put_resp.json()["name"] == "Class 10-B"

    # Delete class
    del_resp = await client.delete(f"/api/classes/{class_id}")
    assert del_resp.status_code == 204

    # Confirm 404
    get_after_del = await client.get(f"/api/classes/{class_id}")
    assert get_after_del.status_code == 404
