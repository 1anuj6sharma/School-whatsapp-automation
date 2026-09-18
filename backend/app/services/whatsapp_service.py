import asyncio
import httpx
from typing import Any, Dict, List, Optional
from app.config import settings
from app.utils.logger import logger
from app.utils.phone import sanitize_phone_number, mask_phone_number

class WhatsAppService:
    def __init__(
        self,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
        api_version: Optional[str] = None,
        timeout: float = 20.0
    ):
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = access_token or settings.WHATSAPP_ACCESS_TOKEN
        self.api_version = api_version or settings.WHATSAPP_API_VERSION
        self.timeout = timeout
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

    def validate_configuration(self) -> tuple[bool, str]:
        if not self.phone_number_id:
            return False, "WHATSAPP_PHONE_NUMBER_ID is not configured in environment."
        if not self.access_token:
            return False, "WHATSAPP_ACCESS_TOKEN is not configured in environment."
        return True, ""

    async def send_template_message(
        self,
        recipient_number: str,
        template_name: str,
        language_code: str = "en_US",
        parameters: Optional[List[str]] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Sends a template message via Meta WhatsApp Cloud API.
        Uses httpx with exponential backoff on 429 rate limits or transient 5xx errors.
        """
        valid, err_msg = self.validate_configuration()
        if not valid:
            logger.error(f"[WhatsAppService] Configuration error: {err_msg}")
            return {
                "success": False,
                "error": err_msg,
                "meta_error": {"type": "ConfigurationError", "message": err_msg}
            }

        sanitized_recipient = sanitize_phone_number(recipient_number)
        masked = mask_phone_number(sanitized_recipient)

        # Build payload according to Meta Cloud API specification
        payload: Dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": sanitized_recipient,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language_code
                }
            }
        }

        # If dynamic parameters are supplied for parameterized templates
        if parameters and len(parameters) > 0:
            payload["template"]["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in parameters]
                }
            ]

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        retry_count = 0
        backoff_delay = 1.0

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while retry_count <= max_retries:
                try:
                    logger.info(
                        f"[WhatsAppService] Sending template '{template_name}' to {masked} (attempt {retry_count + 1}/{max_retries + 1})"
                    )

                    response = await client.post(
                        self.base_url,
                        headers=headers,
                        json=payload
                    )

                    response_json = {}
                    try:
                        response_json = response.json()
                    except Exception:
                        response_json = {"raw_text": response.text}

                    # Handle Success (200 OK)
                    if response.status_code in (200, 201):
                        messages = response_json.get("messages", [])
                        message_id = messages[0].get("id") if messages else None
                        contacts = response_json.get("contacts", [])
                        wa_id = contacts[0].get("wa_id") if contacts else sanitized_recipient

                        logger.info(
                            f"[WhatsAppService] Message sent successfully to {masked} | Message ID: {message_id}"
                        )
                        return {
                            "success": True,
                            "message_id": message_id,
                            "recipient": wa_id,
                            "response_data": response_json
                        }

                    # Handle 429 Rate Limiting or 5xx Server Error with exponential backoff
                    if response.status_code in (429, 500, 502, 503, 504) and retry_count < max_retries:
                        retry_count += 1
                        logger.warning(
                            f"[WhatsAppService] Received HTTP {response.status_code} from Meta for {masked}. Retrying in {backoff_delay}s..."
                        )
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2
                        continue

                    # Extract Meta API specific error structure safely
                    meta_error = response_json.get("error", {})
                    error_message = (
                        meta_error.get("message") or
                        meta_error.get("error_user_msg") or
                        f"Meta API error (HTTP {response.status_code})"
                    )

                    logger.error(
                        f"[WhatsAppService] Failed to send message to {masked} (HTTP {response.status_code}): {error_message}"
                    )
                    return {
                        "success": False,
                        "error": error_message,
                        "status_code": response.status_code,
                        "meta_error": meta_error
                    }

                except httpx.TimeoutException:
                    if retry_count < max_retries:
                        retry_count += 1
                        logger.warning(
                            f"[WhatsAppService] Timeout connecting to Meta API for {masked}. Retrying in {backoff_delay}s..."
                        )
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2
                        continue
                    logger.error(f"[WhatsAppService] Request timed out after {max_retries + 1} attempts for {masked}")
                    return {
                        "success": False,
                        "error": "Request to Meta WhatsApp API timed out.",
                        "meta_error": {"type": "TimeoutError"}
                    }
                except Exception as ex:
                    logger.error(f"[WhatsAppService] Unexpected error sending message to {masked}: {str(ex)}")
                    return {
                        "success": False,
                        "error": f"Internal communication error: {str(ex)}",
                        "meta_error": {"type": type(ex).__name__}
                    }

        return {
            "success": False,
            "error": "Failed after maximum retries.",
            "meta_error": {"type": "MaxRetriesExceeded"}
        }

whatsapp_service = WhatsAppService()
