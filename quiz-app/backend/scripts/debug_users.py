"""
Debug script to check users and their data in Firestore
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

async def debug_users():
    """Debug users and their data"""
    
    print("=" * 60)
    print("DEBUGGING USERS IN FIRESTORE")
    print("=" * 60)
    
    # 1. Fetch all users with order_by cumulative_score
    print("\n1. Fetching users ordered by cumulative_score (DESC):")
    try:
        users_ref = db.collection("users").order_by("cumulative_score", direction=firestore.Query.DESCENDING)
        docs = [doc async for doc in users_ref.stream()]
        print(f"   Found {len(docs)} users")
        
        for doc in docs:
            u = doc.to_dict()
            print(f"\n   User ID: {doc.id}")
            print(f"   - name: {u.get('name')}")
            print(f"   - cumulative_score: {u.get('cumulative_score')}")
            print(f"   - submitted: {u.get('submitted')}")
            
            # Check submissions subcollection
            submissions = [sub async for sub in doc.reference.collection("submissions").stream()]
            print(f"   - submissions count: {len(submissions)}")
            for sub in submissions:
                s_data = sub.to_dict()
                print(f"     - {sub.id}: score={s_data.get('score')}, time_taken={s_data.get('time_taken')}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # 2. Check if any users have cumulative_score > 0
    print("\n" + "=" * 60)
    print("2. Checking cumulative_score values:")
    try:
        users_ref = db.collection("users")
        docs = [doc async for doc in users_ref.stream()]
        for doc in docs:
            u = doc.to_dict()
            cs = u.get("cumulative_score", "NOT_SET")
            print(f"   {doc.id}: cumulative_score = {cs} (type: {type(cs).__name__})")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    print("\n" + "=" * 60)
    print("DEBUG COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(debug_users())
