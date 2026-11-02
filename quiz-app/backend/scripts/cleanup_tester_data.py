import asyncio
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not firebase_admin._apps:
    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db_name = os.getenv("DB_NAME")
db = firestore.AsyncClient(database=db_name)

TARGET_PHONE = "9437555900"

def normalize_phone(phone: str) -> str:
    phone = phone.replace("+91", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    phone = ''.join(filter(str.isdigit, phone))
    if len(phone) > 10 and phone.startswith("91"):
        phone = phone[2:]
    return phone

def serialize_val(val):
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: serialize_val(v) for k, v in val.items()}
    if isinstance(val, list):
        return [serialize_val(v) for v in val]
    return val

async def main():
    print(f"=== Cleaning up tester data for phone {TARGET_PHONE} ===")
    
    # 1. Locate user doc
    user_docs = []
    async for u in db.collection("users").stream():
        uid = u.id
        u_data = u.to_dict()
        phone = str(u_data.get("phone", ""))
        if normalize_phone(uid) == TARGET_PHONE or normalize_phone(phone) == TARGET_PHONE:
            user_docs.append((u.reference, u_data))
            
    if not user_docs:
        print(f"No user document found for {TARGET_PHONE}!")
        return
        
    for ref, data in user_docs:
        print(f"\nProcessing user doc: {ref.id}")
        print(f"Current data: {data}")
        
        # 2. Fetch all submissions
        subs = [s async for s in ref.collection("submissions").stream()]
        print(f"Found {len(subs)} submissions")
        
        backup_data = {
            "user_id": ref.id,
            "user_data": serialize_val(data),
            "submissions": {}
        }
        
        for s in subs:
            s_dict = s.to_dict()
            backup_data["submissions"][s.id] = serialize_val(s_dict)
            
        backup_filename = f"backup_tester_{TARGET_PHONE}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        backup_path = os.path.join(backend_dir, backup_filename)
        
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2)
            
        print(f"✅ Saved backup to {backup_path}")
        
        # 3. Delete submissions
        for s in subs:
            print(f"  Deleting submission {s.id}...")
            await s.reference.delete()
            
        # 4. Reset user document
        await ref.update({
            "submitted": False,
            "has_submitted": False,
            "cumulative_score": 0,
            "cumulative_time": 0,
            "weeks_played": 0
        })
        print(f"✅ Reset user {ref.id} statistics and submission flags.")
        
    print("\n=== Cleanup finished successfully! ===")

if __name__ == "__main__":
    asyncio.run(main())
