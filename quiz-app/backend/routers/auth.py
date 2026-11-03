from fastapi import APIRouter, HTTPException
from schemas.auth import SendOtpRequest, VerifyOtpRequest, RefreshRequest, UserRegister, FirebaseLoginRequest
from services.phone_service import normalize_phone, is_phone_whitelisted, is_tester_phone
from services.sms_service import is_sms_configured
from services.user_service import get_or_create_user, get_user_profile, verify_or_bind_google_email
from auth.otp import generate_and_save_otp, verify_otp_code
from auth.jwt import create_access_token, create_refresh_token, decode_token
import firebase_admin.auth

router = APIRouter(prefix="/api", tags=["Authentication"])

@router.post("/auth/firebase-login")
async def firebase_login(req: FirebaseLoginRequest):
    """
    Exchanges a Firebase Phone Auth ID token for our custom Access Token (15m) + Refresh Token (15d).
    Verifies that the phone number was authenticated directly by Firebase/Google Cloud.
    """
    try:
        if not req.name or not req.name.strip():
            raise HTTPException(status_code=400, detail="Please enter your Name to sign in.")

        decoded_token = firebase_admin.auth.verify_id_token(req.id_token)
        token_phone = decoded_token.get("phone_number")
        token_email = decoded_token.get("email")
        if token_phone:
            # Case 1: Authenticated via Firebase SMS OTP
            phone = token_phone
        elif token_email:
            # Case 2: Authenticated via Google Sign-In (linked to req.phone)
            if not req.phone or not req.phone.strip():
                raise HTTPException(status_code=400, detail="Phone number is required to link Google Sign-In.")
            phone = req.phone.strip()
            await verify_or_bind_google_email(phone, token_email)
        else:
            raise HTTPException(status_code=400, detail="Neither phone_number nor email found in Firebase token.")
            
        # Check whitelist (testers bypass)
        # is_tester = await is_tester_phone(phone)
        # if not is_tester:
        #     whitelisted = await is_phone_whitelisted(phone)
        #     if not whitelisted:
        #         raise HTTPException(
        #             status_code=403,
        #             detail="This phone number is not on our guest list. Please use the WhatsApp number registered with UCE89 Alumni."
        #         )
                
        user_data, has_submitted, week_id = await get_or_create_user(phone, req.name, google_email=token_email if token_email else None)
        user_profile = await get_user_profile(phone)
        
        # Check RBAC role (Designated Admin phone: 9437555900)
        norm_phone = normalize_phone(phone)
        role = "admin" if norm_phone == "9437555900" else "member"
        if "role" not in user_profile or user_profile["role"] != role:
            user_profile["role"] = role
        
        # Issue dual JWT tokens (15m access + 15d refresh)
        access_token = create_access_token(user_id=phone, role=role)
        refresh_token = create_refresh_token(user_id=phone)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": phone,
            "role": role,
            "admin_auth": (role == "admin"),
            "has_submitted": has_submitted,
            "week_id": week_id,
            "user": user_profile
        }
    except firebase_admin.auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")
    except firebase_admin.auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Firebase login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/send-otp")
async def send_otp(req: SendOtpRequest):
    """
    Step 1: Check phone whitelist and dispatch 6-digit OTP.
    For testers, returns fixed OTP 123456 without SMS cost.
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your Name to sign in.")
    phone = req.phone.strip()
    is_tester = await is_tester_phone(phone)
    
    # if not is_tester:
    #     whitelisted = await is_phone_whitelisted(phone)
    #     if not whitelisted:
    #         raise HTTPException(
    #             status_code=403,
    #             detail="This phone number is not on our guest list. Please use the WhatsApp number registered with UCE89 Alumni."
    #         )
            
    code, is_tester, is_resend = await generate_and_save_otp(phone)
    sms_configured = is_sms_configured()
    
    print(f"\n[BACKEND OTP] send_otp requested for phone: {phone}")
    print(f"[BACKEND OTP] Tester: {is_tester} | Resend: {is_resend} | External SMS Provider Configured: {sms_configured}")
    
    response = {
        "status": "success",
        "message": "Verification code resent." if is_resend else "Verification code sent to your phone.",
        "is_resend": is_resend,
        "sms_dispatched": sms_configured
    }
    # Provide debug OTP if tester or when no real SMS provider is configured in .env
    if is_tester or not sms_configured:
        response["debug_otp"] = code
        if not sms_configured and not is_tester:
            response["message"] = f"[Dev Simulation] Code: {code} (No SMS provider in .env)"
        
    return response

@router.post("/auth/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    """
    Step 2: Verify 6-digit OTP code and issue Access Token (15m) + Refresh Token (15d).
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Please enter your Name to sign in.")
    phone = req.phone.strip()
    otp = req.otp.strip()
    
    valid = await verify_otp_code(phone, otp)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
        
    # Get or create user record in Firestore
    user_data, has_submitted, week_id = await get_or_create_user(phone, req.name)
    user_profile = await get_user_profile(phone)
    
    # Check RBAC role (Designated Admin phone: 9437555900)
    norm_phone = normalize_phone(phone)
    role = "admin" if norm_phone == "9437555900" else "member"
    if "role" not in user_profile or user_profile["role"] != role:
        user_profile["role"] = role

    # Generate tokens
    access_token = create_access_token(user_id=phone, role=role)
    refresh_token = create_refresh_token(user_id=phone)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": phone,
        "role": role,
        "admin_auth": (role == "admin"),
        "has_submitted": has_submitted,
        "week_id": week_id,
        "user": user_profile
    }

@router.post("/auth/refresh")
async def refresh_tokens(req: RefreshRequest):
    """
    Silent Refresh: Exchanges a valid 15-day refresh token for a brand new 15-minute access token.
    """
    payload = decode_token(req.refresh_token, expected_type="refresh")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")
        
    norm_user = normalize_phone(user_id)
    role = "admin" if norm_user == "9437555900" else payload.get("role", "member")
    new_access_token = create_access_token(user_id=user_id, role=role)
    new_refresh_token = create_refresh_token(user_id=user_id)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

# ============================================
# ADMIN AUTHENTICATION (Restricted to 9437555900)
# ============================================

ADMIN_PHONE = "9437555900"

@router.post("/auth/admin/send-otp")
async def send_admin_otp(req: SendOtpRequest):
    """
    Sends OTP specifically for Admin Login.
    Strictly verifies that the phone belongs to the designated admin (9437555900).
    """
    phone = req.phone.strip()
    norm = normalize_phone(phone)
    if norm != ADMIN_PHONE:
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: Only designated admin (+91 {ADMIN_PHONE}) can access this panel."
        )
        
    code, is_tester, is_resend = await generate_and_save_otp(phone)
    
    response = {
        "status": "success",
        "message": "Admin verification code resent." if is_resend else "Admin verification code sent to your phone.",
        "is_resend": is_resend
    }
    if is_tester:
        response["debug_otp"] = code
        
    return response

@router.post("/auth/admin/verify-otp")
async def verify_admin_otp(req: VerifyOtpRequest):
    """
    Verifies Admin OTP and issues an admin-scoped JWT token.
    """
    phone = req.phone.strip()
    norm = normalize_phone(phone)
    if norm != ADMIN_PHONE:
        raise HTTPException(status_code=403, detail="Access Denied: Not an authorized admin number.")
        
    valid = await verify_otp_code(phone, req.otp.strip())
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired admin verification code.")
        
    access_token = create_access_token(user_id=phone, role="admin")
    refresh_token = create_refresh_token(user_id=phone)
    
    return {
        "status": "success",
        "admin_auth": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": phone
    }

# ============================================
# LEGACY REGISTRATION ENDPOINT (Backwards Compatible)
# ============================================

@router.post("/register")
async def register_legacy(user: UserRegister):
    """
    Legacy registration endpoint preserved for existing app functionality.
    """
    phone = user.phone.strip()
    is_tester = await is_tester_phone(phone)
    
    # if not is_tester:
    #     whitelisted = await is_phone_whitelisted(phone)
    #     if not whitelisted:
    #         raise HTTPException(
    #             status_code=403, 
    #             detail="This phone number is not on our guest list. Please use the WhatsApp number you registered with us."
    #         )
            
    user_data, has_submitted, week_id = await get_or_create_user(phone, user.name)
    
    # Issue JWT tokens for seamless modern client upgrade
    access_token = create_access_token(user_id=phone, role="member")
    refresh_token = create_refresh_token(user_id=phone)
    
    return {
        "user_id": phone, 
        "has_submitted": has_submitted,
        "week_id": week_id,
        "resuming": not has_submitted,
        "access_token": access_token,
        "refresh_token": refresh_token
    }

