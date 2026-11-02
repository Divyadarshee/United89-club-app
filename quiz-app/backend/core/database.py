import os
import firebase_admin
from firebase_admin import credentials, firestore
from core.config import GOOGLE_APPLICATION_CREDENTIALS, DB_NAME

# Initialize Firebase Admin if not already initialized
try:
    if not firebase_admin._apps:
        if GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
            print(f"Loading credentials from {GOOGLE_APPLICATION_CREDENTIALS}")
            cred = credentials.Certificate(GOOGLE_APPLICATION_CREDENTIALS)
            firebase_admin.initialize_app(cred)
        else:
            print("No local credentials found. Using Application Default Credentials (Cloud Run / GCP).")
            firebase_admin.initialize_app()
except Exception as e:
    print(f"Warning: Failed to initialize Firebase Admin: {e}")

# Async Firestore Client
db = firestore.AsyncClient(database=DB_NAME)
