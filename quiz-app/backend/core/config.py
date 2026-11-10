import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Authentication & Cryptography Config
SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY", "united89-super-secret-club-key-change-in-prod-xyz789")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "15"))

# Database & Object Storage Environment
DB_NAME = os.getenv("DB_NAME")
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "gen-lang-client-0899905004.firebasestorage.app")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if GOOGLE_APPLICATION_CREDENTIALS and not os.path.isabs(GOOGLE_APPLICATION_CREDENTIALS):
    abs_path = os.path.join(BASE_DIR, GOOGLE_APPLICATION_CREDENTIALS.lstrip("./"))
    if os.path.exists(abs_path):
        GOOGLE_APPLICATION_CREDENTIALS = abs_path
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = abs_path

# Cache TTL
CACHE_TTL = 30  # seconds
