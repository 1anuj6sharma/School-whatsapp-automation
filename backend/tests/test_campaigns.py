import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from app.services.whatsapp_service import whatsapp_service

@pytest.mark.asyncio
async def test_campaign_dispatch_and_opt_in_filtering(client: AsyncClient):
    # 1. Create Class
    cls_resp = await client.post("/api/classes", json={"name": "Class 10-A", "section": "A"})
    class_id = cls_resp.json()["id"]

    # 2. Add Student 1 (Opted IN)
    await client.post("/api/students", json={
        "class_id": class_id,
        "student_name": "Rahul Sharma",
        "parent_name": "Rahul Parent",
        "whatsapp_number": "919876543210",
        "whatsapp_opt_in": True
    })

    # 3. Add Student 2 (Opted OUT)
    await client.post("/api/students", json={
        "class_id": class_id,
        "student_name": "Priya Sharma",
        "parent_name": "Priya Parent",
        "whatsapp_number": "919876543211",
        "whatsapp_opt_in": False
    })

    # 4. Create ACTIVE template (hello_world)
    tpl_active = await client.post("/api/templates", json={
        "name": "hello_world",
        "category": "UTILITY",
        "language": "en_US",
        "status": "ACTIVE"
    })
    active_tpl_id = tpl_active.json()["id"]

    # 5. Create PENDING template (student_attendance)
    tpl_pending = await client.post("/api/templates", json={
        "name": "student_attendance",
        "category": "UTILITY",
        "language": "en_US",
        "status": "PENDING"
    })
    pending_tpl_id = tpl_pending.json()["id"]

    # 6. Attempting to send using PENDING template must fail
    pending_send_resp = await client.post("/api/campaigns", json={
        "class_id": class_id,
        "template_id": pending_tpl_id
    })
    assert pending_send_resp.status_code == 400
    assert "ACTIVE" in pending_send_resp.json()["detail"]

    # 7. Mock whatsapp_service.send_template_message to simulate Meta API success
    mock_send = AsyncMock(return_value={
        "success": True,
        "message_id": "wamid.HBgLMTEyMjMzNDQ1NQ==",
        "recipient": "919876543210"
    })

    with patch.object(whatsapp_service, "send_template_message", mock_send):
        campaign_resp = await client.post("/api/campaigns", json={
            "class_id": class_id,
            "template_id": active_tpl_id
        })

        assert campaign_resp.status_code == 201
        campaign_data = campaign_resp.json()
        campaign_id = campaign_data["id"]

        # Check recipient counts: 1 opted-in, 1 skipped
        assert campaign_data["total_recipients"] == 1
        assert campaign_data["skipped_count"] == 1

        # Retrieve campaign details
        detail_resp = await client.get(f"/api/campaigns/{campaign_id}")
        assert detail_resp.status_code == 200
        detail_data = detail_resp.json()
        assert detail_data["total_recipients"] == 1
        assert len(detail_data["message_logs"]) == 2  # 1 queued/sent + 1 skipped
