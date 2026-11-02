from pydantic import BaseModel
from typing import Optional, List

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    batch: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    email: Optional[str] = None

class ProfileResponse(BaseModel):
    user_id: str
    phone: str
    email: Optional[str] = ""
    name: str
    batch: Optional[str] = "1989"
    city: Optional[str] = ""
    bio: Optional[str] = ""
    avatar: Optional[str] = "avatar-1"
    cumulative_score: int = 0
    weeks_played: int = 0
    rank: Optional[str] = "#--"
    badges: List[str] = []
