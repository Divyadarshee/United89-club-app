import uuid
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from datetime import datetime
import pytz

load_dotenv()

# Utility for standardizing time
def get_current_utc_time():
    return datetime.now(pytz.utc)

def get_current_iso_week() -> str:
    """Returns absolute current ISO week identifier, e.g., '2024-W51' (based on system time)"""
    now = datetime.now()
    return f"{now.year}-W{now.isocalendar()[1]:02d}"

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        # Check for local credentials
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
             print(f"Loading credentials from {cred_path}")
             cred = credentials.Certificate(cred_path)
             firebase_admin.initialize_app(cred)
        else:
             print("No local credentials found. Using Application Default Credentials (Cloud Run).")
             firebase_admin.initialize_app()

except Exception as e:
    print(f"Warning: Failed to initialize Firebase: {e}")

# Initialize Firestore Client
DB_NAME = os.getenv("DB_NAME")
db = firestore.Client(database=DB_NAME)

app = FastAPI()

# --- CACHES ---
CACHE_TTL = 30  # seconds
leaderboard_cache: Dict[str, tuple[list, float]] = {} # Key: "weekly_{week_id}" or "overall"

# --- HELPERS ---

def get_active_week_id() -> str:
    """
    Determines the PREFERRED active week.
    1. Checks if there is a week explicitly scheduled for NOW in 'weeks' collection.
    2. If not, falls back to calendar week.
    """
    now = get_current_utc_time()
    
    # Check for active scheduled week
    # Note: This query might require a composite index if we have many weeks. 
    # For small scale, streaming all weeks or caching config is fine.
    # Optimization: Read from 'config/current_week' if we want to force it globally.
    
    # Heuristic: Check if the current ISO week exists in 'weeks' and if it has override times
    iso_week = get_current_iso_week()
    week_doc = db.collection("weeks").document(iso_week).get()
    
    if week_doc.exists:
        data = week_doc.to_dict()
        if data.get("is_active") is False:
            return "inactive" # Explicitly disabled
            
    return iso_week

def get_week_config(week_id: str):
    doc = db.collection("weeks").document(week_id).get()
    if doc.exists:
        return doc.to_dict()
    return None

# --- MODELS ---

class UserRegister(BaseModel):
    name: str
    phone: str

class SubmitAnswers(BaseModel):
    user_id: str
    week_id: str
    answers: Dict[str, str]
    time_taken: int

class QuizConfig(BaseModel):
    timer_duration_minutes: int
    quiz_active: bool
    leaderboard_active: bool = False

class WeekConfig(BaseModel):
    week_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_active: bool = True
    topic: Optional[str] = None
    description: Optional[str] = None

class QuestionCreate(BaseModel):
    id: str
    text: str
    options: List[str]
    answer: str
    order: int
    week_id: str # Required now!

# --- ENDPOINTS ---

@app.post("/api/register")
async def register(user: UserRegister):
    user_id = user.phone
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()

    # Determine current week to check submission status for THAT week
    week_id = get_active_week_id()
    
    has_submitted_this_week = False
    
    if doc.exists:
        # Check sub-collection for this week's submission
        sub_ref = doc_ref.collection("submissions").document(week_id)
        sub_doc = sub_ref.get()
        if sub_doc.exists:
            has_submitted_this_week = True
            
        return {
            "user_id": user_id, 
            "has_submitted": has_submitted_this_week,
            "week_id": week_id,
            "resuming": not has_submitted_this_week # Simplified logic for now
        }

    user_data = {
        "user_id": user_id,
        "name": user.name,
        "phone": user.phone,
        "cumulative_score": 0, # New Field
        "created_at": firestore.SERVER_TIMESTAMP
    }
    
    try:
        doc_ref.set(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"user_id": user_id, "has_submitted": False, "week_id": week_id}

@app.get("/api/questions")
async def get_questions(week_id: Optional[str] = None):
    # If no week_id provided, get for CURRENT active week
    target_week = week_id if week_id else get_active_week_id()
    
    if target_week == "inactive":
        return []

    # Fetch questions for this week
    questions_ref = db.collection("questions").where("week_id", "==", target_week).order_by("order")
    docs = questions_ref.stream()
    
    public_questions = []
    for doc in docs:
        q = doc.to_dict()
        public_questions.append({
            "id": doc.id,
            "text": q["text"],
            "options": q["options"]
        })
    return public_questions

@app.post("/api/submit")
async def submit(submission: SubmitAnswers):
    global leaderboard_cache
    
    # Verify week is valid/active
    # (Skipping strict time validation for now to simplify, but implied by architecture)
    
    week_id = submission.week_id
    
    # Calculate score
    questions_ref = db.collection("questions").where("week_id", "==", week_id)
    docs = questions_ref.stream()
    correct_answers = {doc.id: doc.to_dict().get("correct_answer") for doc in docs}

    score = 0
    for qid, selected_option in submission.answers.items():
        if correct_answers.get(qid) == selected_option:
            score += 1
    
    try:
        user_ref = db.collection("users").document(submission.user_id)
        user_doc = user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        # 1. Save Submission in Sub-collection
        sub_ref = user_ref.collection("submissions").document(week_id)
        if sub_ref.get().exists:
             raise HTTPException(status_code=400, detail="Already submitted for this week")
             
        sub_ref.set({
            "week_id": week_id,
            "score": score,
            "answers": submission.answers,
            "time_taken": submission.time_taken,
            "submitted_at": firestore.SERVER_TIMESTAMP
        })
        
        # 2. Update Cumulative Score (Atomically increment)
        user_ref.update({
            "cumulative_score": firestore.Increment(score)
        })
        
        # Invalidate caches
        leaderboard_cache = {} 
        
    except Exception as e:
        print(f"Submit Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"score": score}

@app.get("/api/leaderboard")
async def get_leaderboard(type: str = "weekly", week_id: Optional[str] = None):
    """
    type: 'weekly' or 'overall'
    week_id: required if type is 'weekly', defaults to current if missing
    """
    global leaderboard_cache
    
    target_week = week_id if week_id else get_active_week_id()
    cache_key = f"{type}_{target_week}" if type == 'weekly' else "overall"
    
    # Cache Check
    current_time = time.time()
    if cache_key in leaderboard_cache:
        data, ts = leaderboard_cache[cache_key]
        if current_time - ts < CACHE_TTL:
            return data

    try:
        users_list = []
        
        if type == "overall":
            # Try new structure (cumulative_score) first
            users_ref = db.collection("users").order_by("cumulative_score", direction=firestore.Query.DESCENDING)
            docs = list(users_ref.stream())
            
            # Fallback: If no cumulative_score data, use old 'score' field
            if len(docs) == 0 or all(d.to_dict().get("cumulative_score", 0) == 0 for d in docs):
                users_ref = db.collection("users").where("submitted", "==", True).order_by("score", direction=firestore.Query.DESCENDING).limit(50)
                docs = list(users_ref.stream())
                for doc in docs:
                    u = doc.to_dict()
                    users_list.append({
                        "name": u.get("name", "Unknown"),
                        "score": u.get("score", 0),
                        "time_taken": u.get("time_taken", 0),  # Single week time
                        "avg_time": u.get("time_taken", 0),
                        "weeks_played": 1,
                        "week_id": "All-Time"
                    })
            else:
                # New structure: Calculate avg time from submissions
                for doc in docs:
                    u = doc.to_dict()
                    
                    # Fetch user's submissions to calculate average time
                    submissions = list(doc.reference.collection("submissions").stream())
                    total_time = 0
                    weeks_count = len(submissions)
                    
                    for sub in submissions:
                        s_data = sub.to_dict()
                        total_time += s_data.get("time_taken", 0)
                    
                    avg_time = round(total_time / weeks_count) if weeks_count > 0 else 0
                    
                    users_list.append({
                        "name": u.get("name", "Unknown"),
                        "score": u.get("cumulative_score", 0),
                        "avg_time": avg_time,
                        "weeks_played": weeks_count,
                        "week_id": "All-Time"
                    })
                
                # Sort by score DESC, then avg_time ASC (tiebreaker)
                users_list.sort(key=lambda x: (-x["score"], x["avg_time"]))
        else:
            # Weekly Leaderboard - Try new submissions structure first
            submissions_query = db.collection_group("submissions").where("week_id", "==", target_week).order_by("score", direction=firestore.Query.DESCENDING).order_by("time_taken", direction=firestore.Query.ASCENDING).limit(50)
            
            subs = list(submissions_query.stream())
            
            if len(subs) > 0:
                # New structure: use submissions
                for sub in subs:
                    s_data = sub.to_dict()
                    name = s_data.get("user_name")
                    if not name:
                        if sub.reference.parent.parent:
                            uid = sub.reference.parent.parent.id
                            u_doc = db.collection("users").document(uid).get()
                            name = u_doc.to_dict().get("name") if u_doc.exists else "Unknown"
                        else:
                            name = "Unknown"
                    
                    users_list.append({
                        "name": name,
                        "score": s_data.get("score", 0),
                        "time_taken": s_data.get("time_taken", 0),
                        "week_id": target_week
                    })
            else:
                # FALLBACK: Old structure - query users directly (pre-migration data)
                # Filter by week_id stored directly on user doc (old format)
                users_ref = db.collection("users").where("submitted", "==", True).where("week_id", "==", target_week)
                docs = list(users_ref.stream())
                
                # Sort by score DESC, time_taken ASC
                sorted_docs = sorted(docs, key=lambda d: (-d.to_dict().get("score", 0), d.to_dict().get("time_taken", float('inf'))))
                
                for doc in sorted_docs[:50]:
                    u = doc.to_dict()
                    users_list.append({
                        "name": u.get("name", "Unknown"),
                        "score": u.get("score", 0),
                        "time_taken": u.get("time_taken", 0),
                        "week_id": target_week
                    })

        # Rank
        for i, u in enumerate(users_list):
            u['rank'] = i + 1
            
        leaderboard_cache[cache_key] = (users_list, current_time)
        return users_list
        
    except Exception as e:
        print(f"LB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/weeks")
async def get_weeks():
    # Return list of weeks + metadata
    # Also generate next 4 weeks for UI convenience
    
    current = get_current_iso_week()
    weeks = []
    
    # TODO: Fetch from 'weeks' collection to get overrides
    # For now, generate basic list centered on current
    
    # Simple logic: just string maniupulation for now or fetch existing from questions?
    # Better: List all weeks that have Questions created OR are in 'weeks' collection
    
    # 1. Get distinct weeks from Questions? (No distinct in firestore)
    # 2. Just return current +/- 4 weeks
    
    now = datetime.now()
    year, week, _ = now.isocalendar()
    
    for i in range(-2, 5): # 2 weeks back, 4 weeks forward
        # Logic to calculate week string
        # Simplified:
        w = week + i
        y = year
        if w > 52:
            w -= 52
            y += 1
        elif w < 1:
            w += 52
            y -= 1
            
        wid = f"{y}-W{w:02d}"
        weeks.append({"week_id": wid, "is_current": (wid == current)})
        
    return weeks

# --- ADMIN Q MANAGEMENT ---

@app.post("/api/admin/questions")
async def add_question(question: QuestionCreate):
    try:
        db.collection("questions").document(question.id).set({
            "text": question.text,
            "options": question.options,
            "correct_answer": question.answer,
            "order": question.order,
            "week_id": question.week_id
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "created"}

@app.get("/api/admin/questions-full")
async def get_questions_full(week_id: Optional[str] = None):
    target_week = week_id if week_id else get_active_week_id()
    
    questions_ref = db.collection("questions").where("week_id", "==", target_week).order_by("order")
    docs = questions_ref.stream()
    
    full_questions = []
    for doc in docs:
        q = doc.to_dict()
        full_questions.append({
            "id": doc.id,
            "text": q["text"],
            "options": q["options"],
            "correct_answer": q["correct_answer"],
            "week_id": q.get("week_id")
        })
    return full_questions

@app.get("/api/config")
async def get_config():
    """Get quiz configuration from Firestore"""
    try:
        doc = db.collection("config").document("quiz_settings").get()
        if doc.exists:
            return doc.to_dict()
        return {"timer_duration_minutes": 10, "quiz_active": True, "leaderboard_active": False}
    except Exception as e:
        return {"timer_duration_minutes": 10, "quiz_active": True, "leaderboard_active": False}

@app.post("/api/admin/config")
async def update_config(config: QuizConfig):
    """Update quiz configuration in Firestore"""
    try:
        db.collection("config").document("quiz_settings").set({
            "timer_duration_minutes": config.timer_duration_minutes,
            "quiz_active": config.quiz_active,
            "leaderboard_active": config.leaderboard_active
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/questions/{question_id}")
async def delete_question(question_id: str):
    db.collection("questions").document(question_id).delete()
    return {"status": "deleted"}

# CORS
origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "https://united89-quiz-frontend-432448119899.asia-south2.run.app",
    "https://united89-quiz-backend-432448119899.asia-south2.run.app",
    "https://united89-club.web.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
