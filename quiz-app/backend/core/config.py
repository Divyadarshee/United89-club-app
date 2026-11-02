import os
from dotenv import load_dotenv

load_dotenv()

# Authentication & Cryptography Config
SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY", "united89-super-secret-club-key-change-in-prod-xyz789")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "15"))

# Database & Environment
DB_NAME = os.getenv("DB_NAME")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Cache TTL
CACHE_TTL = 30  # seconds
