from fastapi import APIRouter, Depends

from app.controllers import auth_controller, onboarding_controller as onboard
from app.middleware.auth import get_current_user
from app.models.onboarding import OtpSend, OtpVerify
from app.models.user import ChangePassword, LoginRequest, ProfileUpdate

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login")
async def login(data: LoginRequest):
    """Single login for every role. The frontend redirects using `user.role`."""
    return await auth_controller.login(data)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.put("/me")
async def update_me(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    return await auth_controller.update_profile(user, data)


@router.post("/change-password")
async def change_password(data: ChangePassword, user: dict = Depends(get_current_user)):
    return await auth_controller.change_password(user, data)


# ---------- Mobile OTP login (every role) ----------
@router.get("/otp/config")
async def otp_config():
    return onboard.otp_config()


@router.get("/otp/demo-accounts")
async def otp_demo_accounts():
    """Only when OTP_DEV_MODE=true: test accounts for the partner login page."""
    return await onboard.demo_accounts()


@router.post("/otp/send")
async def otp_send(data: OtpSend):
    return await onboard.send_otp(data)


@router.post("/otp/verify")
async def otp_verify(data: OtpVerify):
    """door=shop: always the customer account (new number -> new customer, needs_profile).
    door=partner: staff account by priority, or status not_partner."""
    return await onboard.verify_otp(data)
