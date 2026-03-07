from fastapi import APIRouter, HTTPException, Depends
from typing import List
import uuid
from datetime import datetime, timezone

from database import db
from auth import (
    get_current_user, require_admin, hash_password, verify_password,
    create_access_token, ROLE_PERMISSIONS
)
from models import UserCreate, UserLogin, User, TokenResponse, ProfileUpdate, StoreSettings

router = APIRouter()


@router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "canvasser_id": user_data.canvasser_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("password")
    return user_doc


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["id"]})
    user.pop("password")
    return {"token": token, "user": user}


@router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/auth/profile", response_model=User)
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_fields = {}
    if profile_data.name:
        update_fields["name"] = profile_data.name
    if profile_data.email:
        existing = await db.users.find_one({"email": profile_data.email, "id": {"$ne": current_user["id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = profile_data.email
    if profile_data.new_password:
        if not profile_data.current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        user_full = await db.users.find_one({"id": current_user["id"]})
        if not verify_password(profile_data.current_password, user_full["password"]):
            raise HTTPException(status_code=400, detail="Current password incorrect")
        update_fields["password"] = hash_password(profile_data.new_password)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.find_one_and_update(
        {"id": current_user["id"]},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0, "password": 0}
    )
    return result


@router.get("/users", response_model=List[User])
async def get_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(1000)
    return users


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@router.get("/role-permissions")
async def get_role_permissions(current_user: dict = Depends(get_current_user)):
    return {"permissions": ROLE_PERMISSIONS, "current_role": current_user.get("role", ""), "current_permissions": ROLE_PERMISSIONS.get(current_user.get("role", ""), [])}


@router.get("/store-settings")
async def get_store_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.store_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "store_name": "UD. AQIN TANI",
            "address": "Jl. Contoh No. 123, Kota Anda",
            "phone": "(021) 1234-5678",
            "email": "info@aqintani.com",
            "logo_url": ""
        }
    return settings


@router.put("/store-settings")
async def update_store_settings(settings: StoreSettings, admin: dict = Depends(require_admin)):
    settings_doc = settings.model_dump()
    await db.store_settings.delete_many({})
    await db.store_settings.insert_one(settings_doc)
    return settings_doc
