import os
import firebase_admin
from firebase_admin import credentials, firestore, storage
from core.config import GOOGLE_APPLICATION_CREDENTIALS, DB_NAME, STORAGE_BUCKET

# Initialize Firebase Admin if not already initialized
try:
    if not firebase_admin._apps:
        options = {"storageBucket": STORAGE_BUCKET} if STORAGE_BUCKET else {}
        if GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
            print(f"Loading credentials from {GOOGLE_APPLICATION_CREDENTIALS}")
            cred = credentials.Certificate(GOOGLE_APPLICATION_CREDENTIALS)
            firebase_admin.initialize_app(cred, options)
        else:
            print("No local credentials found. Using Application Default Credentials (Cloud Run / GCP).")
            firebase_admin.initialize_app(options=options)
except Exception as e:
    print(f"Warning: Failed to initialize Firebase Admin: {e}")

# Async Firestore Client
try:
    db = firestore.AsyncClient(database=DB_NAME)
except Exception as e:
    print(f"Warning: Failed to initialize firestore.AsyncClient: {e}")
    db = None

# Firebase Cloud Storage Bucket (Object Storage for Media/Images)
try:
    storage_bucket = storage.bucket(STORAGE_BUCKET) if STORAGE_BUCKET else None
except Exception as e:
    print(f"Warning: Failed to initialize Firebase Storage bucket: {e}")
    storage_bucket = None
