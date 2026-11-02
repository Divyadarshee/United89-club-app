from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth.jwt import decode_token

security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Dependency that enforces authentication.
    Extracts Bearer token from header, validates signature & 15m expiration,
    and returns token claims (e.g. {'sub': '+919437555900', 'role': 'member'}).
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = credentials.credentials
    # Validates that this is an 'access' token and not expired
    payload = decode_token(token, expected_type="access")
    return payload

async def get_optional_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict | None:
    """Optional authentication dependency (does not throw 401 if missing)"""
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials, expected_type="access")
    except Exception:
        return None
