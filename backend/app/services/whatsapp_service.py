import asyncio
import re
import httpx
from typing import Any, Dict, List, Optional
from app.config import settings
from app.utils.logger import logger
from app.utils.phone import sanitize_phone_number, mask_phone_number

class WhatsAppService:
    def __init__(
        self,
        phone_number_id: Optional[str] = None,
        waba_id: Optional[str] = None,
        access_token: Optional[str] = None,
        api_version: Optional[str] = None,
        timeout: float = 10.0
    ):
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        self.waba_id = waba_id or settings.WHATSAPP_BUSINESS_ACCOUNT_ID
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

    def get_waba_id(self) -> str:
        return (self.waba_id or settings.WHATSAPP_BUSINESS_ACCOUNT_ID or "").strip()

    async def send_template_message(
        self,
        recipient_number: str,
        template_name: str,
        language_code: str = "en_US",
        parameters: Optional[List[str]] = None,
        header_image_url: Optional[str] = None,
        header_text: Optional[str] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Sends a template message via Meta WhatsApp Cloud API.
        Supports text body parameters and optional media (IMAGE) or text headers.
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

        # Build components array for header and body
        components: List[Dict[str, Any]] = []

        if header_image_url and header_image_url.strip():
            components.append({
                "type": "header",
                "parameters": [
                    {
                        "type": "image",
                        "image": {
                            "link": header_image_url.strip()
                        }
                    }
                ]
            })
        elif header_text and header_text.strip():
            components.append({
                "type": "header",
                "parameters": [
                    {
                        "type": "text",
                        "text": header_text.strip()
                    }
                ]
            })

        # If dynamic parameters are supplied for parameterized body
        if parameters and len(parameters) > 0:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in parameters]
            })

        if components:
            payload["template"]["components"] = components

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
                    logger.error(f"[WhatsAppService] Request timed out connecting to Meta API for {masked}")
                    return {
                        "success": False,
                        "error": "Request to Meta WhatsApp API timed out.",
                        "meta_error": {"type": "TimeoutError"}
                    }
                except httpx.RequestError as req_err:
                    logger.error(f"[WhatsAppService] Network/DNS connection error for {masked}: {req_err}")
                    return {
                        "success": False,
                        "error": f"Network/DNS error connecting to Meta: {str(req_err)}",
                        "meta_error": {"type": "NetworkError", "detail": str(req_err)}
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

    async def fetch_templates_from_meta(self) -> List[Dict[str, Any]]:
        """
        Fetches all message templates directly from Meta WhatsApp Business Account (WABA).
        Endpoint: GET https://graph.facebook.com/{version}/{WABA_ID}/message_templates
        """
        waba_id = self.get_waba_id()
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates?limit=100"
        headers = {"Authorization": f"Bearer {self.access_token}"}

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
                    
                    # Normalize Meta status (APPROVED -> ACTIVE, PENDING -> PENDING, REJECTED -> REJECTED)
                    status = "ACTIVE" if meta_status == "APPROVED" else meta_status
                    
                    components = item.get("components", [])
                    body_text = ""
                    header_type = "NONE"
                    header_text = None

                    for comp in components:
                        c_type = (comp.get("type") or "").upper()
                        if c_type == "HEADER":
                            header_format = (comp.get("format") or "TEXT").upper()
                            header_type = header_format
                            if header_format == "TEXT":
                                header_text = comp.get("text")
                        elif c_type == "BODY":
                            body_text = comp.get("text", "")

                    parsed_templates.append({
                        "name": name,
                        "category": category,
                        "language": language,
                        "status": status,
                        "raw_status": meta_status,
                        "body_preview": body_text or f"Template '{name}' from Meta WhatsApp Manager.",
                        "header_type": header_type,
                        "header_text": header_text,
                        "description": f"Meta {category.title()} Template ({language})" + (f" [Media: {header_type}]" if header_type != "NONE" else ""),
                        "meta_id": item.get("id")
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
        header_type: Optional[str] = "NONE",
        header_text: Optional[str] = None,
        sample_image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submits a new message template directly to Meta WhatsApp Business Account for review.
        Endpoint: POST https://graph.facebook.com/{version}/{WABA_ID}/message_templates
        """
        waba_id = self.get_waba_id()
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        # Clean name: lowercase alphanumeric and underscores only
        clean_name = re.sub(r"[^a-z0-9_]", "_", name.lower().strip())

        components_list: List[Dict[str, Any]] = []
        norm_header_type = (header_type or "NONE").upper().strip()

        # Optional Header Component
        if norm_header_type == "IMAGE":
            header_comp: Dict[str, Any] = {
                "type": "HEADER",
                "format": "IMAGE"
            }
            if sample_image_url and sample_image_url.strip():
                header_comp["example"] = {
                    "header_handle": [sample_image_url.strip()]
                }
            components_list.append(header_comp)
        elif norm_header_type == "TEXT" and header_text and header_text.strip():
            header_comp = {
                "type": "HEADER",
                "format": "TEXT",
                "text": header_text.strip()
            }
            components_list.append(header_comp)

        # Build Body Component
        body_component: Dict[str, Any] = {
            "type": "BODY",
            "text": body_text.strip()
        }

        # Check for placeholders {{1}}, {{2}} in body text
        placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
        if placeholders:
            # Meta requires sample values for each placeholder
            if not sample_values or len(sample_values) < len(placeholders):
                # Provide reasonable default sample values if none given
                sample_values = [f"Sample_{i}" for i in range(1, len(placeholders) + 1)]
            body_component["example"] = {
                "body_text": [sample_values]
            }

        components_list.append(body_component)

        payload = {
            "name": clean_name,
            "category": category.upper(),
            "language": language,
            "components": components_list
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"[WhatsAppService] Creating template '{clean_name}' (Header: {norm_header_type}) on Meta WABA: {waba_id}")
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

                logger.info(f"[WhatsAppService] Template '{clean_name}' created on Meta successfully: ID {data.get('id')}")
                return {
                    "meta_id": data.get("id"),
                    "name": clean_name,
                    "status": data.get("status", "PENDING").upper(),
                    "category": category.upper(),
                    "language": language,
                    "header_type": norm_header_type,
                    "header_text": header_text,
                    "body_preview": body_text.strip()
                }
            except ValueError:
                raise
            except Exception as ex:
                logger.error(f"[WhatsAppService] Exception creating template on Meta: {str(ex)}")
                raise RuntimeError(f"Failed to communicate with Meta API: {str(ex)}")

    async def delete_template_on_meta(self, template_name: str) -> bool:
        """
        Deletes a template from Meta WhatsApp Business Account.
        Endpoint: DELETE https://graph.facebook.com/{version}/{WABA_ID}/message_templates?name={template_name}
        """
        waba_id = self.get_waba_id()
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates"
        headers = {"Authorization": f"Bearer {self.access_token}"}
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
