from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import db
from core.time_utils import get_current_utc_time, get_current_iso_week
from services.phone_service import normalize_phone, is_tester_phone, is_phone_whitelisted
from services.user_service import get_active_week_id, get_user_doc_ref

# Import Routers
from routers import auth, profile, quiz, leaderboard, config, admin

app = FastAPI(
    title="United89 Club & UCE Quiz API",
    description="Modular FastAPI backend with JWT Auth (15m access + 15d refresh), OTP, Member Profiles, and Quiz Management",
    version="2.0.0"
)

# CORS configuration
origins = [
    # Uncomment for local development
    # "http://localhost:5173",
    # "http://localhost:8080",
    # "http://127.0.0.1:5173",
    # "http://127.0.0.1:8080",

    # United89 Prod URLs
    "https://united89-quiz-frontend-432448119899.asia-south2.run.app",
    "https://united89-quiz-backend-432448119899.asia-south2.run.app",
    "https://united89-club.web.app",
    # United89 Dev URLs
    "https://united89-quiz-frontend-dev-432448119899.asia-south2.run.app",
    "https://united89-quiz-backend-dev-432448119899.asia-south2.run.app",
    "https://united89-club-dev.web.app",
    # UCE Prod URLs
    "https://uce-quiz-frontend-432448119899.asia-south2.run.app",
    "https://uce-quiz-backend-432448119899.asia-south2.run.app",
    "https://uce-quiz.web.app",
    # UCE Dev URLs
    "https://uce-quiz-frontend-dev-432448119899.asia-south2.run.app",
    "https://uce-quiz-backend-dev-432448119899.asia-south2.run.app",
    "https://uce-quiz-dev.web.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Modular Routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(quiz.router)
app.include_router(leaderboard.router)
app.include_router(config.router)
app.include_router(admin.router)

@app.get("/health", tags=["Health"])
@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint for Cloud Run and monitoring"""
    return {
        "status": "healthy",
        "service": "united89-backend",
        "version": "2.0.0",
        "active_week": await get_active_week_id()
    }
