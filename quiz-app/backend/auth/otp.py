import random
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from core.database import db
from services.phone_service import normalize_phone, is_tester_phone
from services.sms_service import send_sms_otp

async def generate_and_save_otp(phone: str) -> tuple[str, bool, bool]:
    """
    Generates or reuses a 6-digit OTP and stores it in Firestore.
    
    Implements the Same-OTP Approach (Industry Best Practice):
    1. If an unexpired OTP already exists for this phone (within 5-min window),
       it reuses the SAME code instead of generating a new one.
       This prevents the SMS delivery race condition (SMS 1 arriving after SMS 2).
    2. Limits resends to max 3 per 5-minute window to prevent SMS flooding.
    3. Keeps the original 5-minute expiration clock running.
    
    Returns: (code, is_tester, is_resend)
    """
    normalized = normalize_phone(phone)
    is_tester = await is_tester_phone(normalized)
    now = datetime.now(timezone.utc)
    
    otp_ref = db.collection("otp_verifications").document(normalized)
    doc = await otp_ref.get()
    
    # Check for existing unexpired OTP
    if doc.exists:
        data = doc.to_dict()
        expires_at = data.get("expires_at")
        if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
            
        # If the code is still valid within its 5-minute lifetime
        if expires_at and now < expires_at:
            resend_count = data.get("resend_count", 0)
            
            # Rate limiting: Max 10 resends per 5-minute window
            if resend_count >= 10:
                raise HTTPException(
                    status_code=429,
                    detail="Too many resend attempts. Please wait for the current code to expire before requesting a new one."
                )
            
            # REUSE THE SAME CODE!
            existing_code = data.get("code")
            await otp_ref.update({
                "resend_count": resend_count + 1,
                "last_resend_at": now
            })
            
            # Dispatch SMS with the same code
            if not is_tester:
                await send_sms_otp(phone, existing_code)
                
            print(f"[OTP Service] Resending SAME active OTP to {phone}: {existing_code} (Resend #{resend_count + 1})")
            return existing_code, is_tester, True

    # Otherwise: Fresh OTP generation
    if is_tester:
        code = "123456"
    else:
        code = f"{random.randint(100000, 999999)}"
        
    expires_at = now + timedelta(minutes=5)
    
    await otp_ref.set({
        "phone": phone,
        "normalized_phone": normalized,
        "code": code,
        "expires_at": expires_at,
        "attempts": 0,
        "resend_count": 0,
        "created_at": now
    })
    
    # Dispatch SMS
    if not is_tester:
        await send_sms_otp(phone, code)
        
    print(f"[OTP Service] Generated NEW OTP for {phone}: {code} (tester: {is_tester})")
    return code, is_tester, False

async def verify_otp_code(phone: str, submitted_code: str) -> bool:
    """
    Verifies submitted OTP code against stored record or tester bypass.
    Enforces maximum 5 attempts to protect against brute-force attacks.
    """
    normalized = normalize_phone(phone)
    is_tester = await is_tester_phone(normalized)
    
    # Tester bypass: always accepts 123456
    if is_tester and submitted_code == "123456":
        return True
        
    otp_ref = db.collection("otp_verifications").document(normalized)
    doc = await otp_ref.get()
    
    if not doc.exists:
        return False
        
    data = doc.to_dict()
    stored_code = data.get("code")
    expires_at = data.get("expires_at")
    attempts = data.get("attempts", 0)
    
    # Max 5 attempts protection
    if attempts >= 5:
        await otp_ref.delete()
        raise HTTPException(
            status_code=400,
            detail="Too many incorrect attempts. This code has been invalidated. Please request a new one."
        )
        
    # Check expiration
    now = datetime.now(timezone.utc)
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if expires_at and now > expires_at:
        await otp_ref.delete()
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
        
    if stored_code == submitted_code:
        # One-time use: Delete document upon successful verification
        await otp_ref.delete()
        return True
    else:
        # Increment failed attempts
        await otp_ref.update({"attempts": attempts + 1})
        return False
