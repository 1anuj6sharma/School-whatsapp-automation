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
        sample_values: Optional[List[str]] = None
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

        # Build components
        body_component: Dict[str, Any] = {
            "type": "BODY",
            "text": body_text.strip()
        }

        # Check for placeholders {{1}}, {{2}} in text
        placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
        if placeholders:
            # Meta requires sample values for each placeholder
            if not sample_values or len(sample_values) < len(placeholders):
                # Provide reasonable default sample values if none given
                sample_values = [f"Sample_{i}" for i in range(1, len(placeholders) + 1)]
            body_component["example"] = {
                "body_text": [sample_values]
            }

        payload = {
            "name": clean_name,
            "category": category.upper(),
            "language": language,
            "components": [body_component]
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"[WhatsAppService] Creating template '{clean_name}' on Meta WABA: {waba_id}")
                response = await client.post(url, headers=headers, json=payload)
                data = response.json()

                if response.status_code not in (200, 201):
                    error_data = data.get("error", {})
                    err_msg = error_data.get("message") or error_data.get("error_user_msg") or f"Meta error {response.status_code}"
                    logger.error(f"[WhatsAppService] Meta rejected template creation: {err_msg}")
                    raise ValueError(err_msg)

                logger.info(f"[WhatsAppService] Template '{clean_name}' created on Meta successfully: ID {data.get('id')}")
                return {
                    "meta_id": data.get("id"),
                    "name": clean_name,
                    "status": data.get("status", "PENDING").upper(),
                    "category": category.upper(),
                    "language": language,
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

    def update_credentials(
        self,
        phone_number_id: Optional[str] = None,
        waba_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> None:
        """Dynamically update credentials in-memory for immediate use without server restart."""
        if phone_number_id:
            self.phone_number_id = phone_number_id.strip()
            self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
            settings.WHATSAPP_PHONE_NUMBER_ID = self.phone_number_id
        if waba_id:
            self.waba_id = waba_id.strip()
            settings.WHATSAPP_BUSINESS_ACCOUNT_ID = self.waba_id
        if access_token:
            self.access_token = access_token.strip()
            settings.WHATSAPP_ACCESS_TOKEN = self.access_token

        logger.info(
            f"[WhatsAppService] Credentials updated: Phone ID={self.phone_number_id}, WABA ID={self.waba_id}, Token Configured={bool(self.access_token)}"
        )

    async def exchange_code_for_token(
        self,
        code: str,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchanges OAuth authorization code from Embedded Signup for a Meta User Access Token.
        Endpoint: GET https://graph.facebook.com/{version}/oauth/access_token

        FB.login() popup flows bind the code to an empty/null redirect_uri.
        This method auto-tries all common redirect_uri variants until Meta accepts one.
        """
        target_app_id = (app_id or settings.META_APP_ID or "").strip()
        target_app_secret = (app_secret or settings.META_APP_SECRET or "").strip()

        if not target_app_id or not target_app_secret:
            raise ValueError("META_APP_ID and META_APP_SECRET must be configured to exchange Embedded Signup OAuth code.")

        url = f"https://graph.facebook.com/{self.api_version}/oauth/access_token"

        # Build list of redirect_uri candidates to try in order.
        # FB.login() popup flows typically bind to "" (empty) or omitted.
        # We also try the Cloudflare/frontend URL as a fallback.
        candidates: list[Optional[str]] = []

        # 1. Explicitly provided redirect_uri from the caller
        if redirect_uri and redirect_uri.strip():
            r = redirect_uri.strip()
            candidates.append(r)
            candidates.append(r.rstrip("/") + "/" if not r.endswith("/") else r.rstrip("/"))

        # 2. Configured META_REDIRECT_URI override
        env_uri = (settings.META_REDIRECT_URI or "").strip()
        if env_uri and env_uri not in candidates:
            candidates.append(env_uri)
            candidates.append(env_uri.rstrip("/") + "/" if not env_uri.endswith("/") else env_uri.rstrip("/"))

        # 3. Empty string — standard for FB JS SDK popup (most common)
        if "" not in candidates:
            candidates.append("")

        # 4. None — completely omit redirect_uri param
        if None not in candidates:
            candidates.append(None)

        # 5. Frontend URL from config (Cloudflare tunnel or production domain)
        frontend_url = (settings.FRONTEND_URL or "").strip()
        for fu in [frontend_url, frontend_url.rstrip("/") + "/" if frontend_url and not frontend_url.endswith("/") else None]:
            if fu and fu not in candidates:
                candidates.append(fu)

        # 6. Common localhost fallbacks for dev
        for local in [
            "http://localhost:3010", "http://localhost:3010/",
            "http://localhost:3000", "http://localhost:3000/",
            "http://localhost:5173", "http://localhost:5173/",
        ]:
            if local not in candidates:
                candidates.append(local)

        last_error = "Unknown error during token exchange"
        last_meta_error: Dict[str, Any] = {}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for candidate in candidates:
                params: Dict[str, Any] = {
                    "client_id": target_app_id,
                    "client_secret": target_app_secret,
                    "code": code.strip()
                }
                if candidate is not None:
                    params["redirect_uri"] = candidate

                label = "<omitted>" if candidate is None else f'"{candidate}"'
                logger.info(f"[WhatsAppService] Trying token exchange with redirect_uri={label}")

                try:
                    response = await client.get(url, params=params)
                    data = response.json()

                    if response.status_code == 200 and "access_token" in data:
                        logger.info(f"[WhatsAppService] Token exchange succeeded with redirect_uri={label}")
                        return {
                            "success": True,
                            "access_token": data.get("access_token"),
                            "token_type": data.get("token_type", "bearer"),
                            "expires_in": data.get("expires_in"),
                            "used_redirect_uri": candidate
                        }

                    last_meta_error = data.get("error", {})
                    last_error = last_meta_error.get("message") or f"HTTP {response.status_code}"
                    logger.warning(f"[WhatsAppService] Token exchange failed with redirect_uri={label}: {last_error}")

                    # Only continue cycling if the error is redirect_uri-related
                    error_lower = last_error.lower()
                    if "redirect_uri" not in error_lower and "verification code" not in error_lower:
                        logger.error(f"[WhatsAppService] Non-redirect_uri error — stopping retry: {last_error}")
                        break

                except Exception as ex:
                    logger.error(f"[WhatsAppService] Network error during token exchange: {str(ex)}")
                    last_error = str(ex)
                    break

        logger.error(f"[WhatsAppService] All redirect_uri candidates exhausted. Last error: {last_error}")
        return {
            "success": False,
            "error": last_error,
            "meta_error": last_meta_error
        }


    async def debug_token(
        self,
        input_token: str,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Inspects an access token using Meta debug_token endpoint.
        Useful to extract WABA ID from granular_scopes if not received in session postMessage.
        Endpoint: GET https://graph.facebook.com/{version}/debug_token
        """
        target_app_id = (app_id or settings.META_APP_ID or "").strip()
        target_app_secret = (app_secret or settings.META_APP_SECRET or "").strip()
        app_access_token = f"{target_app_id}|{target_app_secret}"

        url = f"https://graph.facebook.com/{self.api_version}/debug_token"
        params = {
            "input_token": input_token.strip(),
            "access_token": app_access_token
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params)
                data = response.json()
                if response.status_code == 200 and "data" in data:
                    return data.get("data", {})
                logger.warning(f"[WhatsAppService] debug_token returned non-200: {data}")
                return {}
            except Exception as ex:
                logger.error(f"[WhatsAppService] Error debugging token: {str(ex)}")
                return {}

    async def subscribe_app_to_waba(
        self,
        waba_id: str,
        token: Optional[str] = None
    ) -> bool:
        """
        Subscribes the Meta App to the WhatsApp Business Account for webhook notifications.
        Endpoint: POST https://graph.facebook.com/{version}/{WABA_ID}/subscribed_apps
        """
        auth_token = token or self.access_token
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id.strip()}/subscribed_apps"
        headers = {"Authorization": f"Bearer {auth_token}"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, headers=headers)
                data = response.json()
                if response.status_code == 200 and data.get("success"):
                    logger.info(f"[WhatsAppService] Successfully subscribed app to WABA {waba_id}")
                    return True
                logger.warning(f"[WhatsAppService] Could not subscribe app to WABA {waba_id}: {data}")
                return False
            except Exception as ex:
                logger.error(f"[WhatsAppService] Error subscribing app to WABA: {str(ex)}")
                return False

    async def fetch_waba_phone_numbers(
        self,
        waba_id: str,
        token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetches registered phone numbers for a given WABA ID.
        Endpoint: GET https://graph.facebook.com/{version}/{WABA_ID}/phone_numbers
        """
        auth_token = token or self.access_token
        url = f"https://graph.facebook.com/{self.api_version}/{waba_id.strip()}/phone_numbers"
        headers = {"Authorization": f"Bearer {auth_token}"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, headers=headers)
                data = response.json()

                if response.status_code == 200:
                    return data.get("data", [])
                logger.warning(f"[WhatsAppService] Could not fetch phone numbers for WABA {waba_id}: {data}")
                return []
            except Exception as ex:
                logger.error(f"[WhatsAppService] Error fetching WABA phone numbers: {str(ex)}")
                return []

whatsapp_service = WhatsAppService()

