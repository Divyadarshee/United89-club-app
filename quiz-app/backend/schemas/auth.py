from pydantic import BaseModel
from typing import Optional, Dict, Any

class SendOtpRequest(BaseModel):
    phone: str
    name: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class RefreshRequest(BaseModel):
    refresh_token: str

class FirebaseLoginRequest(BaseModel):
    id_token: str
    name: Optional[str] = None
    phone: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    has_submitted: bool = False
    week_id: Optional[str] = None

# Legacy registration model
class UserRegister(BaseModel):
    name: str
    phone: str
