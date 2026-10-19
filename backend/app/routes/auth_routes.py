from fastapi import APIRouter, Depends, status

from app.controllers import auth_controller
from app.middleware.auth import get_current_user
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
