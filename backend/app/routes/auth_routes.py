from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.controllers import auth_controller, onboarding_controller as onboard
from app.middleware.auth import get_current_user
from app.models.onboarding import CustomerSignup, OtpSend, OtpVerify, RiderSignup, StoreSignup
from app.models.user import ChangePassword, LoginRequest, ProfileUpdate, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest):
    """Register as **customer** (needs `address`) or **admin** / shop owner (needs `store`)."""
    return await auth_controller.register(data)


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


@router.post("/otp/send")
async def otp_send(data: OtpSend):
    return await onboard.send_otp(data)


@router.post("/otp/verify")
async def otp_verify(data: OtpVerify):
    """status: ok (logged in) | new (signup_token, ask name / form) | pending | rejected"""
    return await onboard.verify_otp(data)


@router.post("/otp/signup", status_code=status.HTTP_201_CREATED)
async def otp_signup(data: CustomerSignup):
    return await onboard.signup_customer(data)


@router.post("/otp/register-store", status_code=status.HTTP_201_CREATED)
async def otp_register_store(data: StoreSignup):
    return await onboard.signup_store(data)


@router.post("/otp/join-rider", status_code=status.HTTP_201_CREATED)
async def otp_join_rider(data: RiderSignup):
    return await onboard.signup_rider(data)


@router.post("/otp/upload", status_code=status.HTTP_201_CREATED)
async def otp_upload(signup_token: str = Form(...), file: UploadFile = File(...)):
    """Licence photo while joining (before the account exists)."""
    return await onboard.signup_upload(signup_token, file)
