from core.database import db

def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing +91, spaces, dashes, and keeping only digits"""
    phone = phone.replace("+91", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    phone = ''.join(filter(str.isdigit, phone))
    # If number is longer than 10 digits and starts with 91, remove the 91
    if len(phone) > 10 and phone.startswith("91"):
        phone = phone[2:]
    return phone

async def get_tester_phones_set() -> set[str]:
    """Get the set of normalized tester phone numbers from config"""
    try:
        doc = await db.collection("config").document("quiz_settings").get()
        if doc.exists:
            config = doc.to_dict()
            tester_phones = config.get("tester_phones", [])
            return {normalize_phone(t) for t in tester_phones if t}
        return set()
    except Exception as e:
        print(f"Error fetching tester phones: {e}")
        return set()

async def is_tester_phone(phone: str) -> bool:
    """Check if the given phone number is in the tester list"""
    try:
        tester_phones = await get_tester_phones_set()
        return normalize_phone(phone) in tester_phones
    except Exception as e:
        print(f"Error checking tester status: {e}")
        return False

async def is_phone_whitelisted(phone: str) -> bool:
    """Check if phone number is in the approved whitelist"""
    try:
        doc = await db.collection("config").document("phone_whitelist").get()
        if not doc.exists:
            print("No phone whitelist found - allowing all registrations")
            return True
        
        whitelist = doc.to_dict().get("phones", [])
        if not whitelist:
            return True
        
        normalized_input = normalize_phone(phone)
        for whitelisted_phone in whitelist:
            if normalize_phone(whitelisted_phone) == normalized_input:
                return True
        
        return False
    except Exception as e:
        print(f"Error checking phone whitelist: {e}")
        # On error, fail open for reliability
        return True
