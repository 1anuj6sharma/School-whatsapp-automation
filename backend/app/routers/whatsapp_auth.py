from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.config import settings
from app.services.whatsapp_service import whatsapp_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/whatsapp/embedded-signup", tags=["WhatsApp Embedded Signup"])

class EmbeddedSignupExchangeRequest(BaseModel):
    code: Optional[str] = Field(default=None, description="OAuth code returned from Meta Embedded Signup popup (code flow)")
    access_token: Optional[str] = Field(default=None, description="Access token returned directly from FB.login() popup (token flow)")
    waba_id: Optional[str] = Field(default=None, description="WhatsApp Business Account ID from sessionInfo")
    phone_number_id: Optional[str] = Field(default=None, description="WhatsApp Phone Number ID from sessionInfo")
    app_id: Optional[str] = Field(default=None, description="Optional Meta App ID override")
    app_secret: Optional[str] = Field(default=None, description="Optional Meta App Secret override")
    redirect_uri: Optional[str] = Field(default=None, description="The redirect_uri used in the OAuth dialog (sent by frontend)")

class SaveCredentialsRequest(BaseModel):
    phone_number_id: str = Field(..., description="WhatsApp Cloud API Phone Number ID")
    waba_id: Optional[str] = Field(default="", description="WhatsApp Business Account ID")
    access_token: str = Field(..., description="Permanent System User or Long-Lived Access Token")
    verify_token: Optional[str] = Field(default="school_whatsapp_verify_token_secret_123")

@router.get("/config")
async def get_embedded_signup_config() -> Dict[str, Any]:
    """
    Returns public Meta configuration needed by the frontend to initialize Facebook JS SDK.
    """
    is_connected = bool(whatsapp_service.phone_number_id and whatsapp_service.access_token)
    return {
        "meta_app_id": settings.META_APP_ID or "",
        "meta_config_id": settings.META_CONFIG_ID or "",
        "meta_redirect_uri": settings.META_REDIRECT_URI or "",
        "api_version": settings.WHATSAPP_API_VERSION or "v26.0",
        "is_configured": bool(settings.META_APP_ID),
        "is_connected": is_connected,
        "phone_number_id": whatsapp_service.phone_number_id or "",
        "waba_id": whatsapp_service.get_waba_id() or "",
        "has_token": bool(whatsapp_service.access_token)
    }

@router.post("/exchange-token")
async def exchange_token(payload: EmbeddedSignupExchangeRequest) -> Dict[str, Any]:
    """
    Exchanges the authorization code from Meta Embedded Signup for an Access Token.
    Supports Coexistence (WhatsApp Business App Onboarding) by auto-discovering
    WABA ID, phone numbers, verified names, and subscribing to webhooks.
    """
    if not payload.code and not payload.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an authorization code or access_token is required."
        )

    logger.info("[Embedded Signup] Processing Meta token/code from Embedded Signup...")

    # --- Token Flow: accessToken returned directly by FB.login() popup ---
    if payload.access_token and payload.access_token.strip():
        access_token = payload.access_token.strip()
        expires_in = None
        logger.info("[Embedded Signup] Using direct access_token from FB.login() popup (token flow).")

    # --- Code Flow: exchange authorization code for access token ---
    else:
        token_result = await whatsapp_service.exchange_code_for_token(
            code=payload.code,
            app_id=payload.app_id,
            app_secret=payload.app_secret,
            redirect_uri=payload.redirect_uri
        )

        if not token_result.get("success"):
            err_msg = token_result.get("error", "Failed to exchange OAuth code with Meta.")
            logger.error(f"[Embedded Signup] Code exchange failed: {err_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_msg
            )

        access_token = token_result.get("access_token")
        expires_in = token_result.get("expires_in")

    waba_id = (payload.waba_id or "").strip()
    phone_number_id = (payload.phone_number_id or "").strip()
    phone_info: Dict[str, Any] = {}

    # If WABA ID wasn't captured in popup event, inspect token to extract target_ids
    if not waba_id and access_token:
        debug_info = await whatsapp_service.debug_token(
            input_token=access_token,
            app_id=payload.app_id,
            app_secret=payload.app_secret
        )
        granular_scopes = debug_info.get("granular_scopes", [])
        for item in granular_scopes:
            target_ids = item.get("target_ids", [])
            if target_ids and len(target_ids) > 0:
                waba_id = target_ids[0]
                logger.info(f"[Embedded Signup] Auto-discovered WABA ID from debug_token granular_scopes: {waba_id}")
                break

    # Fetch registered phone numbers for the WABA
    if waba_id and access_token:
        phone_list = await whatsapp_service.fetch_waba_phone_numbers(waba_id=waba_id, token=access_token)
        if phone_list and len(phone_list) > 0:
            # If phone_number_id was provided, find its object; otherwise pick the primary one
            matched_phone = None
            if phone_number_id:
                matched_phone = next((p for p in phone_list if str(p.get("id")) == str(phone_number_id)), None)
            if not matched_phone:
                matched_phone = phone_list[0]

            phone_number_id = str(matched_phone.get("id", ""))
            phone_info = {
                "display_phone_number": matched_phone.get("display_phone_number", ""),
                "verified_name": matched_phone.get("verified_name", ""),
                "quality_rating": matched_phone.get("quality_rating", ""),
                "code_verification_status": matched_phone.get("code_verification_status", ""),
            }
            logger.info(
                f"[Embedded Signup] Verified Phone Number: {phone_info.get('display_phone_number')} (ID: {phone_number_id})"
            )

        # Auto-subscribe Meta App to WABA webhooks (for dual WhatsApp Business App + Cloud API sync)
        await whatsapp_service.subscribe_app_to_waba(waba_id=waba_id, token=access_token)

    # Dynamically update the active WhatsApp service credentials
    whatsapp_service.update_credentials(
        phone_number_id=phone_number_id or whatsapp_service.phone_number_id,
        waba_id=waba_id or whatsapp_service.waba_id,
        access_token=access_token
    )

    logger.info(
        f"[Embedded Signup] Successfully connected WABA ID={waba_id}, Phone ID={phone_number_id} with Coexistence support."
    )

    return {
        "success": True,
        "message": "WhatsApp Business Account connected successfully via Meta Embedded Signup.",
        "phone_number_id": whatsapp_service.phone_number_id,
        "waba_id": whatsapp_service.get_waba_id(),
        "phone_info": phone_info,
        "expires_in": expires_in
    }

@router.post("/save-credentials")
async def save_credentials(payload: SaveCredentialsRequest) -> Dict[str, Any]:
    """
    Manually saves or updates credentials (e.g., permanent System User Token or direct IDs).
    """
    whatsapp_service.update_credentials(
        phone_number_id=payload.phone_number_id,
        waba_id=payload.waba_id,
        access_token=payload.access_token
    )
    if payload.verify_token:
        settings.WHATSAPP_VERIFY_TOKEN = payload.verify_token.strip()

    return {
        "success": True,
        "message": "WhatsApp credentials updated successfully.",
        "phone_number_id": whatsapp_service.phone_number_id,
        "waba_id": whatsapp_service.get_waba_id()
    }

@router.post("/disconnect")
async def disconnect_account() -> Dict[str, Any]:
    """
    Clears active WhatsApp credentials from runtime.
    """
    whatsapp_service.update_credentials(
        phone_number_id="",
        waba_id="",
        access_token=""
    )
    return {
        "success": True,
        "message": "WhatsApp Business connection cleared."
    }
