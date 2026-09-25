import asyncio
import re
from typing import Dict, Any, List, Optional
import httpx
from django.conf import settings
from api.utils.logger import logger
from api.utils.phone import sanitize_phone_number, mask_phone_number

class WhatsAppService:
    def __init__(self):
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.business_account_id = settings.WHATSAPP_BUSINESS_ACCOUNT_ID
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.api_version = settings.WHATSAPP_API_VERSION
        self.timeout = 30.0

    @property
    def base_url(self) -> str:
        phone_id = self.get_phone_number_id()
        return f"https://graph.facebook.com/{self.api_version}/{phone_id}/messages"

    def get_phone_number_id(self) -> str:
        return (self.phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID or "").strip()

    def get_waba_id(self) -> str:
        return (self.business_account_id or settings.WHATSAPP_BUSINESS_ACCOUNT_ID or "").strip()

    def get_access_token(self) -> str:
        return (self.access_token or settings.WHATSAPP_ACCESS_TOKEN or "").strip()

    def update_credentials(
        self,
        phone_number_id: Optional[str] = None,
        business_account_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ):
        if phone_number_id:
            self.phone_number_id = phone_number_id.strip()
        if business_account_id:
            self.business_account_id = business_account_id.strip()
        if access_token:
            self.access_token = access_token.strip()
        logger.info(
            f"[WhatsAppService] Credentials updated: Phone ID={self.phone_number_id}, WABA ID={self.business_account_id}, Token Configured={bool(self.access_token)}"
        )

    def is_configured(self) -> bool:
        return bool(self.get_phone_number_id() and self.get_access_token())

    async def send_template_message(
        self,
        recipient_number: str,
        template_name: str,
        language_code: str = "en_US",
        parameters: Optional[List[str]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        phone_id = self.get_phone_number_id()
        token = self.get_access_token()

        if not phone_id or not token:
            err_msg = "Meta WhatsApp credentials not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
            logger.error(f"[WhatsAppService] {err_msg}")
            return {
                "success": False,
                "error": err_msg,
                "meta_error": {"type": "ConfigurationError", "message": err_msg},
            }

        sanitized_recipient = sanitize_phone_number(recipient_number)
        masked = mask_phone_number(sanitized_recipient)

        payload: Dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": sanitized_recipient,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        }

        if parameters and len(parameters) > 0:
            payload["template"]["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in parameters],
                }
            ]

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        retry_count = 0
        backoff_delay = 1.0

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            while retry_count <= max_retries:
                try:
                    logger.info(
                        f"[WhatsAppService] Sending template '{template_name}' to {masked} (attempt {retry_count + 1}/{max_retries + 1})"
                    )

                    response = await client.post(self.base_url, headers=headers, json=payload)
                    response_json = {}
                    try:
                        response_json = response.json()
                    except Exception:
                        response_json = {"raw_text": response.text}

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
                            "response_data": response_json,
                        }

                    if response.status_code in (429, 500, 502, 503, 504) and retry_count < max_retries:
                        retry_count += 1
                        logger.warning(
                            f"[WhatsAppService] HTTP {response.status_code} for {masked}. Retrying in {backoff_delay}s..."
                        )
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2
                        continue

                    meta_error = response_json.get("error", {})
                    error_message = (
                        meta_error.get("message")
                        or meta_error.get("error_user_msg")
                        or f"Meta API error (HTTP {response.status_code})"
                    )
                    logger.error(f"[WhatsAppService] Meta API rejected message for {masked}: {error_message}")
                    return {
                        "success": False,
                        "error": error_message,
                        "meta_error": meta_error,
                        "status_code": response.status_code,
                    }

                except httpx.RequestError as ex:
                    retry_count += 1
                    logger.warning(f"[WhatsAppService] Network error sending to {masked}: {str(ex)}")
                    if retry_count <= max_retries:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2
                    else:
                        return {
                            "success": False,
                            "error": f"Network communication failure: {str(ex)}",
                            "meta_error": {"type": "NetworkError", "detail": str(ex)},
                        }
                except Exception as ex:
                    logger.error(f"[WhatsAppService] Exception sending to {masked}: {str(ex)}")
                    return {
                        "success": False,
                        "error": f"Internal communication error: {str(ex)}",
                        "meta_error": {"type": type(ex).__name__},
                    }

        return {
            "success": False,
            "error": "Failed after maximum retries.",
            "meta_error": {"type": "MaxRetriesExceeded"},
        }

    async def fetch_templates_from_meta(self) -> List[Dict[str, Any]]:
        waba_id = self.get_waba_id()
        token = self.get_access_token()
        if not waba_id or not token:
            raise RuntimeError("WHATSAPP_BUSINESS_ACCOUNT_ID or WHATSAPP_ACCESS_TOKEN is not configured.")

        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates?limit=100"
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"[WhatsAppService] Fetching templates from Meta WABA: {waba_id}")
                response = await client.get(url, headers=headers)
                data = response.json()

                if response.status_code not in (200, 201):
                    err_msg = data.get("error", {}).get("message", f"HTTP {response.status_code}")
                    logger.error(f"[WhatsAppService] Failed to fetch templates from Meta: {err_msg}")
                    raise RuntimeError(f"Meta API Error: {err_msg}")

                raw_templates = data.get("data", [])
                parsed_templates = []

                for item in raw_templates:
                    name = item.get("name", "")
                    category = item.get("category", "UTILITY")
                    language = item.get("language", "en_US")
                    meta_status = item.get("status", "PENDING").upper()
                    status = "ACTIVE" if meta_status == "APPROVED" else meta_status

                    components = item.get("components", [])
                    body_text = ""
                    for comp in components:
                        if comp.get("type") == "BODY":
                            body_text = comp.get("text", "")
                            break

                    parsed_templates.append({
                        "name": name,
                        "category": category,
                        "language": language,
                        "status": status,
                        "raw_status": meta_status,
                        "body_preview": body_text or f"Template '{name}' from Meta WhatsApp Manager.",
                        "description": f"Meta {category.title()} Template ({language})",
                        "meta_id": item.get("id"),
                    })

                logger.info(f"[WhatsAppService] Successfully fetched {len(parsed_templates)} templates from Meta.")
                return parsed_templates
            except Exception as ex:
                logger.error(f"[WhatsAppService] Error querying Meta templates: {str(ex)}")
                raise

    async def create_template_on_meta(
        self,
        name: str,
        category: str,
        language: str,
        body_text: str,
        sample_values: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        waba_id = self.get_waba_id()
        token = self.get_access_token()
        if not waba_id or not token:
            raise RuntimeError("WHATSAPP_BUSINESS_ACCOUNT_ID or WHATSAPP_ACCESS_TOKEN is not configured.")

        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        clean_name = re.sub(r"[^a-z0-9_]", "_", name.lower().strip())
        body_component: Dict[str, Any] = {
            "type": "BODY",
            "text": body_text.strip(),
        }

        placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
        if placeholders:
            if not sample_values or len(sample_values) < len(placeholders):
                sample_values = [f"Sample_{i}" for i in range(1, len(placeholders) + 1)]
            body_component["example"] = {"body_text": [sample_values]}

        payload = {
            "name": clean_name,
            "category": category.upper(),
            "language": language,
            "components": [body_component],
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"[WhatsAppService] Creating template '{clean_name}' on Meta WABA: {waba_id}")
                response = await client.post(url, headers=headers, json=payload)
                data = response.json()

                if response.status_code not in (200, 201):
                    error_data = data.get("error", {})
                    error_user_msg = error_data.get("error_user_msg")
                    error_user_title = error_data.get("error_user_title")
                    details = error_data.get("error_data", {}).get("details")
                    msg = error_data.get("message", f"Meta error {response.status_code}")

                    full_error = f"{error_user_title}: {error_user_msg}" if (error_user_title and error_user_msg) else (error_user_msg or details or msg)
                    logger.error(f"[WhatsAppService] Meta rejected template creation. Full response: {data}")
                    raise ValueError(full_error)

                logger.info(f"[WhatsAppService] Template '{clean_name}' created on Meta: ID {data.get('id')}")
                return {
                    "meta_id": data.get("id"),
                    "name": clean_name,
                    "status": data.get("status", "PENDING").upper(),
                    "category": category.upper(),
                    "language": language,
                    "body_preview": body_text.strip(),
                }
            except ValueError:
                raise
            except Exception as ex:
                logger.error(f"[WhatsAppService] Exception creating template on Meta: {str(ex)}")
                raise RuntimeError(f"Failed to communicate with Meta API: {str(ex)}")

    async def delete_template_on_meta(self, template_name: str) -> bool:
        waba_id = self.get_waba_id()
        token = self.get_access_token()
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"name": template_name}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.delete(url, headers=headers, params=params)
                data = response.json()
                if response.status_code in (200, 201) and data.get("success"):
                    logger.info(f"[WhatsAppService] Template '{template_name}' deleted from Meta.")
                    return True
                logger.warning(f"[WhatsAppService] Could not delete '{template_name}' from Meta: {data}")
                return False
            except Exception as ex:
                logger.error(f"[WhatsAppService] Error deleting template from Meta: {str(ex)}")
                return False

whatsapp_service = WhatsAppService()
