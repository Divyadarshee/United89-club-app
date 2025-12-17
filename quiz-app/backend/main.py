import uuid
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def get_current_week_id() -> str:
    """Returns current ISO week identifier, e.g., '2024-W51'"""
    now = datetime.now()
    return f"{now.year}-W{now.isocalendar()[1]:02d}"

# Initialize Firebase Admin
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
# If firebase_admin is initialized, this uses the same app.
# Or we can let it auto-discover.
DB_NAME = os.getenv("DB_NAME")
db = firestore.Client(database=DB_NAME)

app = FastAPI()

# In-memory cache for leaderboard
# Simple implementation: store (data, timestamp) tuple
# Cache TTL: 30 seconds
CACHE_TTL = 30  # seconds
leaderboard_cache: Optional[tuple[list, float]] = None

# Leaderboard snapshot cache (persisted from Firestore snapshot)
# Format: (rankings_list, week_id)
leaderboard_snapshot_cache: Optional[tuple[list, str]] = None

def compute_leaderboard_for_week(week_id: str) -> list:
    """
    Compute leaderboard for a specific week.
    Fetches all submitted users for that week, sorts by score DESC, time ASC.
    Returns list with rank numbers added.
    """
    try:
        # Query users who submitted in this week
        users_ref = db.collection("users").where("submitted", "==", True).where("week_id", "==", week_id)
        docs = users_ref.stream()
        
        users_list = []
        for doc in docs:
            user = doc.to_dict()
            users_list.append({
                "name": user.get("name", "Unknown"),
                "score": user.get("score", 0),
                "time_taken": user.get("time_taken", 0),
                "week_id": user.get("week_id", "")
            })
        
        # Sort by score DESC, time_taken ASC
        users_list.sort(key=lambda x: x['time_taken'])
        users_list.sort(key=lambda x: x['score'], reverse=True)
        
        # Add rank numbers
        for i, user in enumerate(users_list):
            user['rank'] = i + 1
        
        return users_list
    except Exception as e:
        print(f"Error computing leaderboard for week {week_id}: {e}")
        return []

def save_leaderboard_snapshot(week_id: str, rankings: list):
    """Save leaderboard snapshot to Firestore for historical record."""
    global leaderboard_snapshot_cache
    try:
        db.collection("leaderboard_snapshots").document(week_id).set({
            "week_id": week_id,
            "created_at": firestore.SERVER_TIMESTAMP,
            "rankings": rankings
        })
        # Update in-memory cache
        leaderboard_snapshot_cache = (rankings, week_id)
        print(f"Leaderboard snapshot saved for {week_id}")
    except Exception as e:
        print(f"Error saving leaderboard snapshot: {e}")

def get_leaderboard_snapshot(week_id: str) -> Optional[list]:
    """Get leaderboard from cache or Firestore snapshot."""
    global leaderboard_snapshot_cache
    
    # Check memory cache first
    if leaderboard_snapshot_cache is not None:
        cached_data, cached_week = leaderboard_snapshot_cache
        if cached_week == week_id:
            return cached_data
    
    # Check Firestore snapshot
    try:
        doc = db.collection("leaderboard_snapshots").document(week_id).get()
        if doc.exists:
            data = doc.to_dict()
            rankings = data.get("rankings", [])
            # Cache it
            leaderboard_snapshot_cache = (rankings, week_id)
            return rankings
    except Exception as e:
        print(f"Error fetching leaderboard snapshot: {e}")
    
    return None

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

# Hardcoded Questions REMOVED in favor of Firestore

# Pydantic Models
class UserRegister(BaseModel):
    name: str
    phone: str

class SubmitAnswers(BaseModel):
    user_id: str
    answers: Dict[str, str]
    time_taken: int

class QuizConfig(BaseModel):
    timer_duration_minutes: int
    quiz_active: bool
    leaderboard_active: bool = False

class QuestionCreate(BaseModel):
    id: str
    text: str
    options: List[str]
    answer: str
    order: int

@app.post("/api/register")
async def register(user: UserRegister):
    # Use Phone as User ID
    user_id = user.phone
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
        has_submitted = data.get("submitted", False)
        # Return status instead of error, allowing user to proceed to Rules page
        return {"user_id": user_id, "has_submitted": has_submitted, "resuming": not has_submitted}

    user_data = {
        "user_id": user_id,
        "name": user.name,
        "phone": user.phone,
        "score": 0,
        "answers": {},
        "submitted": False,
        "created_at": firestore.SERVER_TIMESTAMP
    }
    
    try:
        doc_ref.set(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"user_id": user_id, "has_submitted": False}

@app.get("/api/questions")
async def get_questions():
    # Fetch questions from Firestore sorted by order
    questions_ref = db.collection("questions").order_by("order")
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

@app.get("/api/config")
async def get_config():
    doc_ref = db.collection("config").document("quiz_settings")
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        # Ensure new fields are present
        if "leaderboard_active" not in data:
            data["leaderboard_active"] = False
        return data
    return {"timer_duration_minutes": 10, "quiz_active": True, "leaderboard_active": False}

@app.post("/api/submit")
async def submit(submission: SubmitAnswers):
    global leaderboard_cache
    
    # Calculate score from DB
    questions_ref = db.collection("questions")
    docs = questions_ref.stream()
    correct_answers = {doc.id: doc.to_dict().get("correct_answer") for doc in docs}

    score = 0
    for qid, selected_option in submission.answers.items():
        if correct_answers.get(qid) == selected_option:
            score += 1
    
    # Update Firestore
    try:
        doc_ref = db.collection("users").document(submission.user_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
            
        doc_ref.update({
            "answers": submission.answers,
            "score": score,
            "time_taken": submission.time_taken,
            "submitted": True,
            "submitted_at": firestore.SERVER_TIMESTAMP,
            "week_id": get_current_week_id()
        })
        
        # Invalidate leaderboard cache on new submission
        leaderboard_cache = None
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"score": score}

# Admin Endpoints
@app.post("/api/admin/config")
async def update_config(config: QuizConfig):
    """
    Update quiz configuration.
    When leaderboard_active is set to true:
    1. Automatically set quiz_active to false
    2. Compute leaderboard rankings for current week
    3. Save snapshot to Firestore for fast retrieval
    """
    global leaderboard_snapshot_cache
    
    try:
        config_dict = config.dict()
        
        # If enabling leaderboard, auto-disable quiz and compute snapshot
        if config.leaderboard_active:
            config_dict['quiz_active'] = False
            
            # Get current week ID
            week_id = get_current_week_id()
            
            # Compute rankings for this week
            rankings = compute_leaderboard_for_week(week_id)
            
            # Save snapshot to Firestore and cache
            save_leaderboard_snapshot(week_id, rankings)
            
            # Store current week in config for reference
            config_dict['current_week_id'] = week_id
            
            print(f"Leaderboard enabled: quiz closed, snapshot saved for {week_id}")
        
        db.collection("config").document("quiz_settings").set(config_dict)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "updated", "quiz_active": config_dict.get('quiz_active'), "leaderboard_active": config_dict.get('leaderboard_active')}

@app.post("/api/admin/questions")
async def add_question(question: QuestionCreate):
    try:
        db.collection("questions").document(question.id).set({
            "text": question.text,
            "options": question.options,
            "correct_answer": question.answer,
            "order": question.order
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "created"}

@app.delete("/api/admin/questions/{question_id}")
async def delete_question(question_id: str):
    try:
        db.collection("questions").document(question_id).delete()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "deleted"}

@app.get("/api/admin/questions-full")
async def get_questions_full():
    # Fetch all questions including correct answers for admin view
    questions_ref = db.collection("questions").order_by("order")
    docs = questions_ref.stream()
    
    full_questions = []
    for doc in docs:
        q = doc.to_dict()
        full_questions.append({
            "id": doc.id,
            "text": q["text"],
            "options": q["options"],
            "correct_answer": q["correct_answer"]
        })
    return full_questions

@app.get("/api/admin/users")
async def get_users():
    global leaderboard_cache
    
    # Check cache validity
    current_time = time.time()
    if leaderboard_cache is not None:
        cached_data, cache_time = leaderboard_cache
        if current_time - cache_time < CACHE_TTL:
            # Cache hit - return cached data
            return cached_data
    
    # Cache miss or expired - fetch from Firestore
    try:
        users_ref = db.collection("users").order_by("score", direction=firestore.Query.DESCENDING).order_by("time_taken", direction=firestore.Query.ASCENDING)
        docs = users_ref.stream()
        users = []
        for doc in docs:
            users.append(doc.to_dict())
        
        # Update cache
        leaderboard_cache = (users, current_time)
        
        return users
    except Exception as e:
        print(f"Error getting users: {e}") # Debug log
        raise HTTPException(status_code=500, detail=str(e))

# Public Leaderboard Endpoint (no sensitive data)
@app.get("/api/leaderboard")
async def get_leaderboard():
    """
    Public leaderboard endpoint - returns only safe data (no phone/answers).
    Priority: 1) Memory cache 2) Firestore snapshot 3) Live compute
    """
    # First, get the current week_id from config to know which snapshot to load
    try:
        config_doc = db.collection("config").document("quiz_settings").get()
        if config_doc.exists:
            config_data = config_doc.to_dict()
            current_week = config_data.get("current_week_id", get_current_week_id())
        else:
            current_week = get_current_week_id()
        
        # Try to get from snapshot (fast path)
        snapshot_data = get_leaderboard_snapshot(current_week)
        if snapshot_data is not None:
            return snapshot_data
        
        # Fallback: compute live (for when no snapshot exists yet)
        users_ref = db.collection("users").where("submitted", "==", True)
        docs = users_ref.stream()
        
        users_list = []
        for doc in docs:
            user = doc.to_dict()
            users_list.append({
                "name": user.get("name", "Unknown"),
                "score": user.get("score", 0),
                "time_taken": user.get("time_taken", 0),
                "week_id": user.get("week_id", "")
            })
            
        # Sort by score DESC, time_taken ASC in memory
        users_list.sort(key=lambda x: x['time_taken'])
        users_list.sort(key=lambda x: x['score'], reverse=True)
        
        # Add rank numbers
        for i, user in enumerate(users_list):
            user['rank'] = i + 1
        
        return users_list
    except Exception as e:
        print(f"Error getting leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
