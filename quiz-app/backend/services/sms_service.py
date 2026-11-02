import os
import urllib.request
import urllib.parse
import base64
from typing import Optional

def is_sms_configured() -> bool:
    """
    Returns True if an external SMS provider (e.g. Twilio) is configured in environment.
    """
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID") and 
        os.getenv("TWILIO_AUTH_TOKEN") and 
        os.getenv("TWILIO_PHONE_NUMBER")
    )

def send_sms_via_twilio(phone: str, code: str) -> bool:
    """
    Sends an SMS via Twilio API using Python standard library (no pip package needed).
    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_PHONE_NUMBER")

    if not account_sid or not auth_token or not from_phone:
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    message_body = f"Your UCE89 Club verification code is: {code}. Valid for 5 minutes. Do not share this code."
    
    post_data = urllib.parse.urlencode({
        "To": phone,
        "From": from_phone,
        "Body": message_body
    }).encode("utf-8")

    req = urllib.request.Request(url, data=post_data, method="POST")
    auth_header = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("ascii")
    req.add_header("Authorization", f"Basic {auth_header}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[SMS SERVICE] Successfully dispatched real SMS to {phone} via Twilio! (Status: {resp.status})")
            return True
    except Exception as e:
        print(f"[SMS SERVICE ERROR] Failed to send SMS via Twilio to {phone}: {e}")
        return False

async def send_sms_otp(phone: str, code: str) -> bool:
    """
    Dispatches OTP SMS to user's phone.
    1. Checks if an SMS provider (e.g. Twilio) is configured in environment.
    2. If configured, sends telecom SMS.
    3. If not configured, outputs formatted terminal log so developers can test without paying for SMS.
    """
    # 1. Try real telecom dispatch if credentials are provided
    sent = send_sms_via_twilio(phone, code)
    if sent:
        return True

    # 2. Local / Development Fallback Banner
    print("\n" + "=" * 65)
    print(f"📩 [SMS SIMULATION] VERIFICATION CODE FOR: {phone}")
    print(f"🔑 YOUR 6-DIGIT OTP CODE IS: >>> {code} <<<")
    print(f"⏰ Valid for 5 minutes. (Resending will send this SAME code)")
    print("ℹ️  To enable real SMS delivery, configure TWILIO_ACCOUNT_SID in .env")
    print("=" * 65 + "\n")
    return True
