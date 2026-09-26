import os
import asyncio
import re
from pathlib import Path
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

    async def get_app_id(self) -> Optional[str]:
        app_id = (getattr(settings, "META_APP_ID", "") or os.getenv("META_APP_ID", "")).strip()
        if app_id:
            return app_id

        token = self.get_access_token()
        if not token:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"https://graph.facebook.com/{self.api_version}/app",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if res.status_code == 200:
                    data = res.json()
                    discovered_id = data.get("id")
                    if discovered_id:
                        logger.info(f"[WhatsAppService] Auto-discovered Meta App ID: {discovered_id}")
                        return str(discovered_id)
        except Exception as e:
            logger.warning(f"[WhatsAppService] Could not auto-discover Meta App ID: {e}")
        return None

    async def upload_sample_media_handle(self, file_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[str]:
        """
        Uploads sample image to Meta Resumable Upload API to generate a valid header_handle.
        Required by Meta for templates with IMAGE / DOCUMENT / VIDEO headers.
        """
        token = self.get_access_token()
        app_id = await self.get_app_id()
        if not token or not app_id:
            logger.warning(f"[WhatsAppService] Cannot upload media handle: Token configured={bool(token)}, App ID={app_id}")
            return None

        file_length = len(file_bytes)
        create_session_url = f"https://graph.facebook.com/{self.api_version}/{app_id}/uploads"
        params = {
            "file_length": file_length,
            "file_type": mime_type,
            "access_token": token,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Step 1: Create upload session on Meta
                logger.info(f"[WhatsAppService] Initializing Meta upload session for {file_length} bytes ({mime_type})...")
                session_resp = await client.post(create_session_url, params=params)
                session_data = session_resp.json()
                if session_resp.status_code not in (200, 201):
                    logger.error(f"[WhatsAppService] Meta upload session initialization failed: {session_data}")
                    return None

                upload_session_id = session_data.get("id")
                if not upload_session_id:
                    return None

                # Step 2: Upload raw binary image bytes to the session
                upload_url = f"https://graph.facebook.com/{self.api_version}/{upload_session_id}"
                upload_headers = {
                    "Authorization": f"OAuth {token}",
                    "file_offset": "0",
                    "Content-Type": "application/octet-stream",
                }
                upload_resp = await client.post(upload_url, headers=upload_headers, content=file_bytes)
                upload_data = upload_resp.json()
                if upload_resp.status_code in (200, 201):
                    handle = upload_data.get("h")
                    logger.info(f"[WhatsAppService] Meta sample media handle created successfully: {handle}")
                    return handle
                else:
                    logger.error(f"[WhatsAppService] Failed to upload binary bytes to Meta upload session: {upload_data}")
                    return None
            except Exception as ex:
                logger.error(f"[WhatsAppService] Exception uploading sample media to Meta: {ex}")
                return None

    async def upload_broadcast_media(self, file_bytes: bytes, filename: str, mime_type: str = "image/jpeg") -> Optional[str]:
        """
        Uploads media directly to Meta's /{phone_number_id}/media endpoint to get a media_id.
        This allows sending images from localhost / local disk without needing a public domain.
        """
        phone_id = self.get_phone_number_id()
        token = self.get_access_token()
        if not phone_id or not token:
            logger.error("[WhatsAppService] Cannot upload media: Phone ID or Token missing.")
            return None

        import hashlib
        file_hash = hashlib.md5(file_bytes).hexdigest()
        if not hasattr(self, "_media_id_cache"):
            self._media_id_cache = {}
        if file_hash in self._media_id_cache:
            cached_id = self._media_id_cache[file_hash]
            logger.info(f"[WhatsAppService] Using cached Meta media_id: {cached_id} for {filename}")
            return cached_id

        url = f"https://graph.facebook.com/{self.api_version}/{phone_id}/media"
        headers = {"Authorization": f"Bearer {token}"}
        files = {
            "messaging_product": (None, "whatsapp"),
            "type": (None, mime_type),
            "file": (filename, file_bytes, mime_type),
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            try:
                logger.info(f"[WhatsAppService] Uploading broadcast media to Meta ({filename}, {len(file_bytes)} bytes)...")
                response = await client.post(url, headers=headers, files=files)
                res_data = response.json()
                if response.status_code in (200, 201):
                    media_id = res_data.get("id")
                    logger.info(f"[WhatsAppService] Meta media uploaded successfully! Media ID: {media_id}")
                    self._media_id_cache[file_hash] = media_id
                    return media_id
                else:
                    logger.error(f"[WhatsAppService] Meta media upload failed (HTTP {response.status_code}): {res_data}")
                    return None
            except Exception as ex:
                logger.error(f"[WhatsAppService] Exception uploading media to Meta: {ex}")
                return None

    async def _resolve_image_media_id(self, raw_url: str) -> Optional[str]:
        """
        Resolves an image URL or local path to a Meta media_id by checking local disk locations
        or downloading public URLs and uploading to Meta.
        """
        if not raw_url or not raw_url.strip():
            return None
        raw = raw_url.strip()
        if raw.isdigit() and len(raw) > 10:
            return raw

        local_filename = Path(raw).name
        candidates = [
            os.path.join(str(settings.MEDIA_ROOT), local_filename),
            os.path.join(str(settings.BASE_DIR), "data", "uploads", local_filename),
            os.path.join("/app/data/uploads", local_filename),
            os.path.join("c:/inverosoft/School whatsapp/backend/data/uploads", local_filename),
        ]
        if "/uploads/" in raw:
            rel = raw.split("/uploads/")[-1]
            candidates.extend([
                os.path.join(str(settings.MEDIA_ROOT), rel),
                os.path.join(str(settings.BASE_DIR), "data", "uploads", rel),
                os.path.join("/app/data/uploads", rel),
                os.path.join("c:/inverosoft/School whatsapp/backend/data/uploads", rel),
            ])
        if os.path.exists(raw):
            candidates.insert(0, raw)

        img_bytes = None
        chosen_filename = local_filename
        mime_type = "image/png" if local_filename.lower().endswith(".png") else "image/jpeg"

        for p in candidates:
            if os.path.exists(p) and os.path.isfile(p):
                try:
                    with open(p, "rb") as f:
                        img_bytes = f.read()
                        if img_bytes:
                            chosen_filename = os.path.basename(p)
                            mime_type = "image/png" if chosen_filename.lower().endswith(".png") else "image/jpeg"
                            logger.info(f"[WhatsAppService] Found local broadcast image at {p} ({len(img_bytes)} bytes)")
                            break
                except Exception as ex:
                    logger.warning(f"[WhatsAppService] Could not read local file {p}: {ex}")

        if not img_bytes and (raw.startswith("http://") or raw.startswith("https://")):
            if "localhost" not in raw and "127.0.0.1" not in raw:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as fetch_client:
                        r = await fetch_client.get(raw)
                        if r.status_code == 200:
                            img_bytes = r.content
                            ct = r.headers.get("Content-Type", "")
                            if ct:
                                mime_type = ct.split(";")[0].strip()
                except Exception as e:
                    logger.warning(f"[WhatsAppService] Could not download image from {raw}: {e}")

        if img_bytes:
            return await self.upload_broadcast_media(img_bytes, filename=chosen_filename, mime_type=mime_type)

        return None

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
        header_image_url: Optional[str] = None,
        header_text: Optional[str] = None,
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

        # Look up template definition from DB to ensure header type and language match Meta
        tpl_header_type = None
        tpl_language = None
        try:
            from api.models import MessageTemplate
            tpl = MessageTemplate.objects.filter(name=template_name).first()
            if tpl:
                tpl_header_type = (tpl.header_type or "NONE").upper()
                if tpl.language:
                    tpl_language = tpl.language
                if not header_image_url and not header_text:
                    if tpl_header_type == "IMAGE" and tpl.sample_image_url:
                        header_image_url = tpl.sample_image_url
                    elif tpl_header_type == "TEXT" and tpl.header_text:
                        header_text = tpl.header_text
        except Exception:
            pass

        effective_lang = tpl_language or language_code or "en_US"

        payload: Dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": sanitized_recipient,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": effective_lang},
            },
        }

        components: List[Dict[str, Any]] = []

        # Only add header parameter if template is configured for a header
        if (tpl_header_type != "NONE" and tpl_header_type != "TEXT") and header_image_url and header_image_url.strip():
            raw_url = header_image_url.strip()

            if raw_url.isdigit() and len(raw_url) > 10:
                # Direct media ID provided
                components.append({
                    "type": "header",
                    "parameters": [{"type": "image", "image": {"id": raw_url}}]
                })
            elif raw_url.startswith("https://") and "localhost" not in raw_url and "127.0.0.1" not in raw_url:
                # Public HTTPS URL (e.g. Cloudflare tunnel, CDN, S3) - preferred by Meta for templates
                logger.info(f"[WhatsAppService] Using direct public HTTPS link for template image header: {raw_url}")
                components.append({
                    "type": "header",
                    "parameters": [{"type": "image", "image": {"link": raw_url}}]
                })
            else:
                # Local file or localhost URL - upload directly to Meta to obtain media_id
                media_id = await self._resolve_image_media_id(raw_url)
                if media_id:
                    components.append({
                        "type": "header",
                        "parameters": [{"type": "image", "image": {"id": media_id}}]
                    })
                elif raw_url.startswith("https://"):
                    components.append({
                        "type": "header",
                        "parameters": [{"type": "image", "image": {"link": raw_url}}]
                    })
                else:
                    err_msg = f"Could not resolve or upload image header for '{raw_url}'."
                    logger.error(f"[WhatsAppService] {err_msg}")
                    return {
                        "success": False,
                        "error": err_msg,
                        "meta_error": {"type": "MediaError", "message": err_msg},
                    }
        elif (tpl_header_type == "TEXT" or not tpl_header_type) and header_text and header_text.strip():
            components.append({
                "type": "header",
                "parameters": [
                    {
                        "type": "text",
                        "text": header_text.strip()
                    }
                ]
            })

        if parameters and len(parameters) > 0:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in parameters],
            })

        if components:
            payload["template"]["components"] = components

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
        header_type: Optional[str] = "NONE",
        header_text: Optional[str] = None,
        sample_image_url: Optional[str] = None,
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
        components_list: List[Dict[str, Any]] = []
        norm_header_type = (header_type or "NONE").upper().strip()

        # Optional Header Component
        if norm_header_type == "IMAGE":
            header_comp: Dict[str, Any] = {
                "type": "HEADER",
                "format": "IMAGE",
            }

            sample_handle = None
            if sample_image_url and sample_image_url.strip():
                val = sample_image_url.strip()
                if val.startswith("4:") or (not val.startswith("http") and not val.startswith("/") and len(val) > 20):
                    # Already a Meta handle
                    sample_handle = val
                else:
                    # Resolve image bytes from local disk or URL
                    local_filename = Path(val).name
                    local_path = os.path.join(settings.MEDIA_ROOT, local_filename)

                    img_bytes = None
                    mime_type = "image/png" if local_filename.lower().endswith(".png") else "image/jpeg"

                    if os.path.exists(local_path):
                        try:
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                        except Exception as e:
                            logger.warning(f"[WhatsAppService] Could not read local image {local_path}: {e}")

                    if not img_bytes and (val.startswith("http://") or val.startswith("https://")):
                        try:
                            async with httpx.AsyncClient(timeout=15.0) as fetch_client:
                                r = await fetch_client.get(val)
                                if r.status_code == 200:
                                    img_bytes = r.content
                                    ct = r.headers.get("Content-Type", "")
                                    if ct:
                                        mime_type = ct.split(";")[0].strip()
                        except Exception as e:
                            logger.warning(f"[WhatsAppService] Could not download sample image from {val}: {e}")

                    if img_bytes:
                        sample_handle = await self.upload_sample_media_handle(img_bytes, mime_type=mime_type)

            if sample_handle:
                header_comp["example"] = {"header_handle": [sample_handle]}

            components_list.append(header_comp)
        elif norm_header_type == "TEXT" and header_text and header_text.strip():
            components_list.append({
                "type": "HEADER",
                "format": "TEXT",
                "text": header_text.strip(),
            })

        # Body Component
        body_component: Dict[str, Any] = {
            "type": "BODY",
            "text": body_text.strip(),
        }

        placeholders = re.findall(r"\{\{(\d+)\}\}", body_text)
        if placeholders:
            if not sample_values or len(sample_values) < len(placeholders):
                sample_values = [f"Sample_{i}" for i in range(1, len(placeholders) + 1)]
            body_component["example"] = {"body_text": [sample_values]}

        components_list.append(body_component)

        payload = {
            "name": clean_name,
            "category": category.upper(),
            "language": language,
            "components": components_list,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"[WhatsAppService] Creating template '{clean_name}' on Meta WABA: {waba_id} (Header: {norm_header_type})")
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
                    "header_type": norm_header_type,
                    "header_text": header_text if norm_header_type == "TEXT" else None,
                    "sample_image_url": sample_image_url if norm_header_type == "IMAGE" else None,
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
