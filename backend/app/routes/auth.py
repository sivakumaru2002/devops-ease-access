from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth import (
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
    authenticate_user,
    change_password,
    create_access_token,
    create_user,
    get_current_user,
    list_users,
    require_roles,
)
from app.db.mongodb import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(user)
    return LoginResponse(access_token=token, username=user.username, role=user.role)


@router.get("/users", response_model=list[UserResponse])
async def get_users(
    _: UserResponse = Depends(require_roles("admin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await list_users(db)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_auth_user(
    request: CreateUserRequest,
    current_user=Depends(require_roles("admin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        return await create_user(db, request, current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_current_user_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        await change_password(db, current_user.username, request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc