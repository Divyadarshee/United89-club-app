from fastapi import APIRouter, Depends, HTTPException
from schemas.profile import ProfileUpdateRequest
from services.user_service import get_user_profile, update_user_profile
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/profile", tags=["Profile"])

@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """
    Returns current authenticated member's profile and quiz standing.
    Identity is derived directly from the verified 15-minute Access Token.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User identification missing in token")
        
    profile = await get_user_profile(user_id)
    return profile

@router.put("/me")
async def update_my_profile(
    updates: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates editable profile fields (name, batch, city, bio, avatar).
    Phone number and user_id cannot be changed.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User identification missing in token")
        
    updated_profile = await update_user_profile(user_id, updates.dict(exclude_unset=True))
    return {
        "status": "success",
        "message": "Profile updated successfully",
        "user": updated_profile
    }
