"""
One-time script to add 'submitted: True' field to all users who have submissions
"""
import asyncio
import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
            print(f"Loading credentials from {cred_path}")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("No local credentials found. Using Application Default Credentials.")
            firebase_admin.initialize_app()
except Exception as e:
    print(f"Warning: Failed to initialize Firebase: {e}")

# Initialize Firestore Client
DB_NAME = os.getenv("DB_NAME")
db = firestore.AsyncClient(database=DB_NAME)

async def fix_submitted_field():
    """Add 'submitted: True' to all users who have at least one submission"""
    
    print("Fetching all users...")
    users_ref = db.collection("users")
    users = [doc async for doc in users_ref.stream()]
    
    updated_count = 0
    
    for user_doc in users:
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        
        # Check if user has any submissions
        submissions = [sub async for sub in user_doc.reference.collection("submissions").stream()]
        
        if len(submissions) > 0:
            # User has submissions, ensure 'submitted' is set to True
            if not user_data.get("submitted"):
                print(f"Updating user {user_id} ({user_data.get('name')}) - has {len(submissions)} submission(s)")
                await user_doc.reference.update({"submitted": True})
                updated_count += 1
            else:
                print(f"User {user_id} already has 'submitted: True'")
        else:
            print(f"User {user_id} has no submissions, skipping")
    
    print(f"\n✅ Updated {updated_count} user(s)")

if __name__ == "__main__":
    asyncio.run(fix_submitted_field())
