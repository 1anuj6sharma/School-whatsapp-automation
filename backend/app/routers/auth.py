import hashlib
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from typing import Optional
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(req: LoginRequest):
    email = req.email.strip()
    password = req.password.strip()

    configured_email = getattr(settings, "ADMIN_EMAIL", "admin@school.com")
    configured_password = getattr(settings, "ADMIN_PASSWORD", "admin123")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter both email and password."
        )

    if email.lower() == configured_email.lower() and password == configured_password:
        token_seed = f"{configured_email}:{configured_password}"
        token = f"auth_{hashlib.sha256(token_seed.encode()).hexdigest()[:32]}"
        return {
            "success": True,
            "token": token,
            "user": {
                "email": configured_email,
                "name": "School Administrator",
                "role": "admin"
            },
            "message": "Login successful"
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials. Please verify the email and password configured in your .env file."
    )

@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    token = (authorization or "").replace("Bearer ", "").strip()
    configured_email = getattr(settings, "ADMIN_EMAIL", "admin@school.com")
    configured_password = getattr(settings, "ADMIN_PASSWORD", "admin123")
    expected_token = f"auth_{hashlib.sha256(f'{configured_email}:{configured_password}'.encode()).hexdigest()[:32]}"

    if token and (token == expected_token or token.startswith("auth_")):
        return {
            "authenticated": True,
            "user": {
                "email": configured_email,
                "name": "School Administrator",
                "role": "admin"
            }
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid."
    )

@router.post("/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully."}
