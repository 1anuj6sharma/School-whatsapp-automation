import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.services.whatsapp_service import WhatsAppService

@pytest.mark.asyncio
async def test_whatsapp_service_missing_config():
    service = WhatsAppService(phone_number_id="", access_token="")
    result = await service.send_template_message("919876543210", "hello_world")
    assert result["success"] is False
    assert "not configured" in result["error"]

@pytest.mark.asyncio
async def test_whatsapp_service_successful_send():
    service = WhatsAppService(
        phone_number_id="1234567890",
        access_token="EAABtesttoken",
        api_version="v26.0"
    )

    mock_response = httpx.Response(
        status_code=200,
        json={
            "messaging_product": "whatsapp",
            "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
            "messages": [{"id": "wamid.HBgL1234567890"}]
        },
        request=httpx.Request("POST", "https://graph.facebook.com/v26.0/1234567890/messages")
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        result = await service.send_template_message(
            recipient_number="919876543210",
            template_name="hello_world",
            language_code="en_US"
        )

        assert result["success"] is True
        assert result["message_id"] == "wamid.HBgL1234567890"
        assert result["recipient"] == "919876543210"

@pytest.mark.asyncio
async def test_whatsapp_service_meta_error_response():
    service = WhatsAppService(
        phone_number_id="1234567890",
        access_token="invalid_token",
        api_version="v26.0"
    )

    mock_response = httpx.Response(
        status_code=401,
        json={
            "error": {
                "message": "Invalid OAuth access token.",
                "type": "OAuthException",
                "code": 190,
                "fbtrace_id": "AbCdEf"
            }
        },
        request=httpx.Request("POST", "https://graph.facebook.com/v26.0/1234567890/messages")
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        result = await service.send_template_message(
            recipient_number="919876543210",
            template_name="hello_world"
        )

        assert result["success"] is False
        assert "Invalid OAuth access token" in result["error"]
        assert result["meta_error"]["code"] == 190
