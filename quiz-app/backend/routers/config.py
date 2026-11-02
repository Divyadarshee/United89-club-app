from fastapi import APIRouter, HTTPException
from core.database import db
from schemas.quiz import QuizConfig

router = APIRouter(prefix="/api", tags=["Configuration"])

@router.get("/config")
async def get_config():
    """Get quiz configuration from Firestore"""
    try:
        doc = await db.collection("config").document("quiz_settings").get()
        if doc.exists:
            data = doc.to_dict()
            data.setdefault("tester_phones", [])
            data.setdefault("answers_visible", False)
            data.setdefault("active_theme", "default")
            data.setdefault("finale_mode", "testers_only")
            return data
        return {
            "timer_duration_minutes": 10,
            "quiz_active": True,
            "leaderboard_active": False,
            "answers_visible": False,
            "tester_phones": [],
            "active_theme": "default",
            "finale_mode": "testers_only"
        }
    except Exception:
        return {
            "timer_duration_minutes": 10,
            "quiz_active": True,
            "leaderboard_active": False,
            "answers_visible": False,
            "tester_phones": [],
            "active_theme": "default",
            "finale_mode": "testers_only"
        }

@router.post("/admin/config")
async def update_config(config: QuizConfig):
    """Update quiz configuration in Firestore"""
    try:
        await db.collection("config").document("quiz_settings").set({
            "timer_duration_minutes": config.timer_duration_minutes,
            "quiz_active": config.quiz_active,
            "leaderboard_active": config.leaderboard_active,
            "answers_visible": config.answers_visible,
            "tester_phones": config.tester_phones,
            "active_theme": config.active_theme,
            "finale_mode": config.finale_mode or "testers_only"
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
