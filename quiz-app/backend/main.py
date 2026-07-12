import uuid
import os
import time
import random
import hashlib
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from datetime import datetime
import pytz

from ai.genai import generate_questions_by_ai, generate_trending_topics, generate_tiered_questions, regenerate_tiered_questions

load_dotenv()

# Utility for standardizing time
def get_current_utc_time():
    return datetime.now(pytz.utc)

def get_current_iso_week() -> str:
    """Returns absolute current ISO week identifier, e.g., '2024-W51' (based on system time)"""
    now = datetime.now()
    iso_cal = now.isocalendar()
    # Use iso_cal[0] (ISO year) not now.year, because Dec 31 may belong to Week 1 of next year
    return f"{iso_cal[0]}-W{iso_cal[1]:02d}"

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
db = firestore.AsyncClient(database=DB_NAME)

app = FastAPI()

# --- CACHES ---
CACHE_TTL = 30  # seconds
leaderboard_cache: Dict[str, tuple[list, float]] = {} # Key: "weekly_{week_id}" or "overall"

# --- HELPERS ---

async def get_active_week_id() -> str:
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
    week_doc = await db.collection("weeks").document(iso_week).get()
    
    if week_doc.exists:
        data = week_doc.to_dict()
        if data.get("is_active") is False:
            return "inactive" # Explicitly disabled
            
    return iso_week

async def get_week_config(week_id: str):
    doc = await db.collection("weeks").document(week_id).get()
    if doc.exists:
        return doc.to_dict()
    return None

async def is_tester_phone(phone: str) -> bool:
    """Check if the given phone number is in the tester list"""
    try:
        doc = await db.collection("config").document("quiz_settings").get()
        if doc.exists:
            config = doc.to_dict()
            tester_phones = config.get("tester_phones", [])
            # Normalize the input phone for comparison
            normalized_input = normalize_phone(phone)
            # Check against normalized tester phones
            for tester in tester_phones:
                if normalize_phone(tester) == normalized_input:
                    return True
        return False
    except Exception as e:
        print(f"Error checking tester status: {e}")
        return False

def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing +91, spaces, dashes, and keeping only digits"""
    # Remove common prefixes and formatting
    phone = phone.replace("+91", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    # Keep only digits
    phone = ''.join(filter(str.isdigit, phone))
    # If number is longer than 10 digits and starts with 91, remove the 91
    if len(phone) > 10 and phone.startswith("91"):
        phone = phone[2:]
    return phone

async def is_phone_whitelisted(phone: str) -> bool:
    """Check if phone number is in the approved whitelist"""
    try:
        doc = await db.collection("config").document("phone_whitelist").get()
        if not doc.exists:
            # If no whitelist exists, allow all (backward compatible)
            print("No phone whitelist found - allowing all registrations")
            return True
        
        whitelist = doc.to_dict().get("phones", [])
        if not whitelist:
            # Empty whitelist means allow all
            return True
        
        normalized_input = normalize_phone(phone)
        
        # Check if normalized phone is in whitelist
        for whitelisted_phone in whitelist:
            if normalize_phone(whitelisted_phone) == normalized_input:
                return True
        
        return False
    except Exception as e:
        print(f"Error checking phone whitelist: {e}")
        # On error, allow registration (fail open for reliability)
        return True

async def get_answers_visible() -> bool:
    """Check if answers are visible to users"""
    try:
        doc = await db.collection("config").document("quiz_settings").get()
        if doc.exists:
            return doc.to_dict().get("answers_visible", False)
        return False
    except Exception as e:
        print(f"Error checking answers visibility: {e}")
        return False

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
    answers_visible: bool = False  # Controls when users can see correct answers
    tester_phones: List[str] = []  # Phone numbers that can bypass submission limit

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

class QuestionBatchCreate(BaseModel):
    questions: List[QuestionCreate]

# --- ENDPOINTS ---

@app.post("/api/register")
async def register(user: UserRegister):
    user_id = user.phone
    
    # Check if user is a tester (testers bypass whitelist)
    is_tester = await is_tester_phone(user_id)
    
    # Validate phone against whitelist (unless tester)
    if not is_tester:
        is_whitelisted = await is_phone_whitelisted(user_id)
        if not is_whitelisted:
            raise HTTPException(
                status_code=403, 
                detail="This phone number is not on our guest list. Please use the WhatsApp number you registered with us."
            )
    
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()

    # Determine current week to check submission status for THAT week
    week_id = await get_active_week_id()
    
    has_submitted_this_week = False

    if doc.exists:
        existing_data = doc.to_dict()
        
        # Update name if user provided a different one (allows fixing typos)
        if existing_data.get("name") != user.name:
            await doc_ref.update({"name": user.name})
        
        # Check sub-collection for this week's submission
        sub_ref = doc_ref.collection("submissions").document(week_id)
        sub_doc = await sub_ref.get()
        if sub_doc.exists:
            has_submitted_this_week = True
            
        # Tester Override: Testers are never blocked by UI
        if is_tester:
            has_submitted_this_week = False

        return {
            "user_id": user_id, 
            "has_submitted": has_submitted_this_week,
            "week_id": week_id,
            "resuming": not has_submitted_this_week
        }

    user_data = {
        "user_id": user_id,
        "name": user.name,
        "phone": user.phone,
        "cumulative_score": 0, # New Field
        "created_at": firestore.SERVER_TIMESTAMP
    }
    
    try:
        await doc_ref.set(user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"user_id": user_id, "has_submitted": False, "week_id": week_id}

@app.get("/api/questions")
async def get_questions(week_id: Optional[str] = None, user_id: Optional[str] = None):
    # If no week_id provided, get for CURRENT active week
    target_week = week_id if week_id else await get_active_week_id()
    
    if target_week == "inactive":
        return []

    # Fetch questions for this week
    questions_ref = db.collection("questions").where("week_id", "==", target_week).order_by("order")
    docs = [doc async for doc in questions_ref.stream()]
    
    public_questions = []
    for doc in docs:
        q = doc.to_dict()
        public_questions.append({
            "id": doc.id,
            "text": q["text"],
            "options": q["options"]
        })
    
    # Shuffle questions based on user_id for per-user randomization
    # This makes question order unique per user but consistent for same user
    if user_id:
        # Create a deterministic seed from user_id + week_id
        seed_str = f"{user_id}_{target_week}"
        seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (10**9)
        random.seed(seed)
        random.shuffle(public_questions)
        random.seed()  # Reset to default randomness
    
    return public_questions

@app.post("/api/submit")
async def submit(submission: SubmitAnswers):
    global leaderboard_cache
    
    # Verify week is valid/active
    # (Skipping strict time validation for now to simplify, but implied by architecture)
    
    week_id = submission.week_id
    
    # Calculate score
    questions_ref = db.collection("questions").where("week_id", "==", week_id)
    docs = [doc async for doc in questions_ref.stream()]
    correct_answers = {doc.id: doc.to_dict().get("correct_answer") for doc in docs}

    score = 0
    for qid, selected_option in submission.answers.items():
        if correct_answers.get(qid) == selected_option:
            score += 1
    
    try:
        user_ref = db.collection("users").document(submission.user_id)
        user_doc = await user_ref.get()
        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if user is a tester
        is_tester = await is_tester_phone(submission.user_id)
        
        # 1. Save Submission in Sub-collection
        sub_ref = user_ref.collection("submissions").document(week_id)
        sub_doc = await sub_ref.get()
        
        # Handle existing submission (tester re-submission)
        old_time = 0
        old_score = 0
        is_resubmission = False
        
        if sub_doc.exists:
            if is_tester:
                # Tester: Allow re-submission by overwriting
                print(f"[TESTER] {submission.user_id} is re-submitting for week {week_id}")
                old_data = sub_doc.to_dict()
                old_score = old_data.get("score", 0)
                old_time = old_data.get("time_taken", 0)
                is_resubmission = True
            else:
                raise HTTPException(status_code=400, detail="Already submitted for this week")
        
        # Get user's name for denormalization
        user_data = user_doc.to_dict()
        user_name = user_data.get("name", "Unknown")
             
        # 1. Save Submission in Sub-collection (only quiz-related data + cached name)
        await sub_ref.set({
            "week_id": week_id,
            "score": score,
            "answers": submission.answers,
            "time_taken": submission.time_taken,
            "user_name": user_name,
            "submitted_at": firestore.SERVER_TIMESTAMP
        })
        
        # 2. Update User document with aggregated stats
        if is_resubmission:
            # Tester re-submission: subtract old values, add new ones
            await user_ref.update({
                "cumulative_score": firestore.Increment(score - old_score),
                "cumulative_time": firestore.Increment(submission.time_taken - old_time),
                # weeks_played stays the same for re-submission
            })
        else:
            # First submission for this week
            await user_ref.update({
                "cumulative_score": firestore.Increment(score),
                "cumulative_time": firestore.Increment(submission.time_taken),
                "weeks_played": firestore.Increment(1),
                "submitted": True
            })
        
        # Invalidate caches
        leaderboard_cache = {} 
        
    except Exception as e:
        print(f"Submit Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"score": score}

@app.get("/api/leaderboard")
async def get_leaderboard(type: str = "weekly", week_id: Optional[str] = None, admin: bool = False):
    """
    type: 'weekly' or 'overall'
    week_id: required if type is 'weekly', defaults to current if missing
    admin: if True, bypasses anti-cheating restrictions (shows all scores)
    
    Anti-cheating logic (when admin=False):
    - For current week: scores are hidden (returned as null)
    - For overall: only aggregates up to LAST week (excludes current week)
    """
    global leaderboard_cache
    
    current_week = await get_active_week_id()
    target_week = week_id if week_id else current_week
    is_current_week = (target_week == current_week) and not admin
    exclude_current_in_overall = not admin  # Admin sees all data
    
    cache_key = f"{type}_{target_week}" if type == 'weekly' else f"overall_excl_{current_week}"
    if admin:
        cache_key = f"admin_{cache_key}"  # Separate cache for admin
    
    # Cache Check
    current_time = time.time()
    if cache_key in leaderboard_cache:
        data, ts = leaderboard_cache[cache_key]
        if current_time - ts < CACHE_TTL:
            return data

    try:
        users_list = []
        
        if type == "overall":
            # For overall leaderboard, we calculate aggregates EXCLUDING the current week
            # This prevents users from deducing their current week score from all-time changes
            
            # Get all users who have submitted at least once
            users_ref = db.collection("users").where("submitted", "==", True)
            user_docs = [doc async for doc in users_ref.stream()]
            
            all_submitted_weeks = set()
            
            for user_doc in user_docs:
                u = user_doc.to_dict()
                user_id = user_doc.id
                
                # Get all submissions for this user EXCEPT current week
                submissions_ref = db.collection("users").document(user_id).collection("submissions")
                subs = [sub async for sub in submissions_ref.stream()]
                
                # Calculate aggregate excluding current week
                total_score = 0
                total_time = 0
                weeks_count = 0
                
                for sub in subs:
                    s_data = sub.to_dict()
                    sub_week = s_data.get("week_id", "")
                    
                    # Skip current week in overall calculation (unless admin)
                    if (exclude_current_in_overall and sub_week == current_week) or (sub_week in ["2026-W04"]):
                        continue
                    
                    all_submitted_weeks.add(sub_week)
                    total_score += s_data.get("score", 0)
                    total_time += s_data.get("time_taken", 0)
                    weeks_count += 1
                
                # Skip users with no past week submissions
                if weeks_count == 0:
                    continue
                
                avg_time = round(total_time / weeks_count)
                
                users_list.append({
                    "user_id": user_id,
                    "name": u.get("name", "Unknown"),
                    "score": total_score,
                    "avg_time": avg_time,
                    "weeks_played": weeks_count,
                    "week_id": "All-Time"
                })
            
            # Get all unique week IDs from questions
            questions_ref = db.collection("questions").select(["week_id"])
            q_docs = [doc async for doc in questions_ref.stream()]
            quiz_weeks = {doc.to_dict().get("week_id") for doc in q_docs if doc.to_dict().get("week_id")}
            
            # Union and filter to get total weeks
            valid_weeks = set()
            for w in quiz_weeks.union(all_submitted_weeks):
                if w == "2026-W04":
                    continue
                if exclude_current_in_overall and w == current_week:
                    continue
                if w > current_week:
                    continue
                valid_weeks.add(w)
                
            total_weeks = len(valid_weeks)
            for u in users_list:
                u["total_weeks"] = total_weeks
            
            # Sort by score DESC, then avg_time ASC (tiebreaker)
            users_list.sort(key=lambda x: (-x["score"], x["avg_time"]))
        else:
            # Weekly Leaderboard - Query submissions for the specific week
            submissions_query = db.collection_group("submissions").where("week_id", "==", target_week).order_by("score", direction=firestore.Query.DESCENDING).order_by("time_taken", direction=firestore.Query.ASCENDING).limit(50)
            
            subs = [sub async for sub in submissions_query.stream()]
            
            for sub in subs:
                s_data = sub.to_dict()
                
                # Use cached user_name from submission (no extra query needed)
                name = s_data.get("user_name", "Unknown")
                
                # Get user_id from the parent path (users/{user_id}/submissions/{week_id})
                user_id = sub.reference.parent.parent.id if sub.reference.parent.parent else None
                
                # For current week, hide scores (anti-cheating)
                users_list.append({
                    "user_id": user_id,
                    "name": name,
                    "score": None if is_current_week else s_data.get("score", 0),
                    "time_taken": s_data.get("time_taken", 0),
                    "week_id": target_week,
                    "is_current_week": is_current_week  # Flag for frontend
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
        await db.collection("questions").document(question.id).set({
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
    target_week = week_id if week_id else await get_active_week_id()
    
    questions_ref = db.collection("questions").where("week_id", "==", target_week).order_by("order")
    docs = [doc async for doc in questions_ref.stream()]
    
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
        doc = await db.collection("config").document("quiz_settings").get()
        if doc.exists:
            data = doc.to_dict()
            # Ensure required fields are always present
            if "tester_phones" not in data:
                data["tester_phones"] = []
            if "answers_visible" not in data:
                data["answers_visible"] = False
            return data
        return {"timer_duration_minutes": 10, "quiz_active": True, "leaderboard_active": False, "answers_visible": False, "tester_phones": []}
    except Exception as e:
        return {"timer_duration_minutes": 10, "quiz_active": True, "leaderboard_active": False, "answers_visible": False, "tester_phones": []}

@app.post("/api/admin/config")
async def update_config(config: QuizConfig):
    """Update quiz configuration in Firestore"""
    try:
        await db.collection("config").document("quiz_settings").set({
            "timer_duration_minutes": config.timer_duration_minutes,
            "quiz_active": config.quiz_active,
            "leaderboard_active": config.leaderboard_active,
            "answers_visible": config.answers_visible,
            "tester_phones": config.tester_phones
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/admin/questions/{question_id}")
async def delete_question(question_id: str):
    await db.collection("questions").document(question_id).delete()
    return {"status": "deleted"}

@app.get("/api/admin/submission/{user_id}")
async def get_user_submission(user_id: str, week_id: str):
    """Fetch a specific user's submission details for a given week"""
    try:
        sub_ref = db.collection("users").document(user_id).collection("submissions").document(week_id)
        sub_doc = await sub_ref.get()
        
        if not sub_doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        data = sub_doc.to_dict()
        return {
            "user_id": user_id,
            "week_id": week_id,
            "score": data.get("score", 0),
            "time_taken": data.get("time_taken", 0),
            "answers": data.get("answers", {})
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/my-submission/{user_id}")
async def get_my_submission(user_id: str, week_id: Optional[str] = None):
    """
    Public endpoint for users to view their own submission with question details.
    Returns submission data along with questions and correct answers for answer review.
    Correct answers are only shown if answers_visible is True in config.
    """
    try:
        # Use provided week_id or get current active week
        target_week = week_id if week_id else await get_active_week_id()
        
        if target_week == "inactive":
            raise HTTPException(status_code=400, detail="No active quiz week")
        
        # Check if answers should be visible:
        # 1. True if the week has passed (i.e., target_week < current_iso_week)
        # 2. Otherwise, defer to global configuration
        current_iso_week = get_current_iso_week()
        if target_week < current_iso_week:
            answers_visible = True
        else:
            answers_visible = await get_answers_visible()
        
        # Get user's submission
        sub_ref = db.collection("users").document(user_id).collection("submissions").document(target_week)
        sub_doc = await sub_ref.get()
        
        if not sub_doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        submission_data = sub_doc.to_dict()
        user_answers = submission_data.get("answers", {})
        
        # Get questions for this week with correct answers
        questions_ref = db.collection("questions").where("week_id", "==", target_week).order_by("order")
        questions_docs = [doc async for doc in questions_ref.stream()]
        
        questions_with_answers = []
        for doc in questions_docs:
            q = doc.to_dict()
            question_id = doc.id
            user_answer = user_answers.get(question_id, None)
            correct_answer = q.get("correct_answer")
            
            question_data = {
                "id": question_id,
                "text": q.get("text"),
                "options": q.get("options", []),
                "user_answer": user_answer,
                # Always include is_correct so users can see right/wrong regardless of answers_visible
                "is_correct": user_answer == correct_answer if user_answer is not None else False,
            }
            
            # Only reveal the actual correct answer text when answers_visible is True
            if answers_visible:
                question_data["correct_answer"] = correct_answer
            
            questions_with_answers.append(question_data)
        
        return {
            "user_id": user_id,
            "week_id": target_week,
            "score": submission_data.get("score", 0),
            "time_taken": submission_data.get("time_taken", 0),
            "questions": questions_with_answers,
            "answers_visible": answers_visible
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/generate-questions")
async def generate_question(week_id: str):
    """Legacy endpoint for generating questions (backward compatibility)"""
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > week_id:
        print(f"Trying to generate questions for past week ({week_id}). Current is {current_iso_week_id}")
        raise HTTPException(status_code=403, detail="Cannot generate questions for past weeks")

    return await generate_questions_by_ai()


# ============================================
# NEW TWO-STEP QUESTION GENERATION ENDPOINTS
# ============================================

@app.post("/api/admin/generate-topics")
async def generate_topics_endpoint(week_id: str):
    """
    Step 1: Generate trending topics using Google Search.
    Returns a list of 10-15 trending topics from recent news.
    Admin will select 3-5 topics for current affairs questions.
    """
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > week_id:
        print(f"Trying to generate topics for past week ({week_id}). Current is {current_iso_week_id}")
        raise HTTPException(status_code=403, detail="Cannot generate topics for past weeks")

    try:
        topics = await generate_trending_topics()
        return {"topics": topics, "week_id": week_id}
    except Exception as e:
        print(f"Error generating topics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate topics: {str(e)}")


# Import request schemas from schema.py
from schema import GenerateQuestionsRequest, RegenerateQuestionsRequest


@app.post("/api/admin/generate-tiered-questions")
async def generate_tiered_questions_endpoint(request: GenerateQuestionsRequest):
    """
    Step 2: Generate tiered quiz questions with selected trending topics.
    Returns questions organized by difficulty:
    - 10 Easy questions
    - 6 Medium questions  
    - 4 Hard questions
    
    Admin will select 5 Easy + 3 Medium + 2 Hard = 10 final questions.
    """
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > request.week_id:
        print(f"Trying to generate questions for past week ({request.week_id}). Current is {current_iso_week_id}")
        raise HTTPException(status_code=403, detail="Cannot generate questions for past weeks")

    if not request.selected_topics or len(request.selected_topics) == 0:
        raise HTTPException(status_code=400, detail="At least one topic must be selected")

    try:
        questions = await generate_tiered_questions(request.selected_topics, request.week_id)
        return {
            "questions": questions,
            "week_id": request.week_id,
            "selected_topics": request.selected_topics,
            "session_id": questions.get("session_id")
        }
    except Exception as e:
        print(f"Error generating tiered questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")


@app.post("/api/admin/regenerate-questions")
async def regenerate_questions_endpoint(request: RegenerateQuestionsRequest):
    """
    Regenerate quiz questions using agent memory.
    Uses the same session to maintain context about selected topics.
    Accepts user feedback to customize the regeneration.
    """
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > request.week_id:
        raise HTTPException(status_code=403, detail="Cannot regenerate questions for past weeks")

    if not request.session_id:
        raise HTTPException(status_code=400, detail="Session ID is required for regeneration")

    if not request.feedback:
        raise HTTPException(status_code=400, detail="Feedback is required for regeneration")

    try:
        questions = await regenerate_tiered_questions(request.session_id, request.feedback)
        return {
            "questions": questions,
            "week_id": request.week_id,
            "session_id": questions.get("session_id")
        }
    except Exception as e:
        print(f"Error regenerating questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate questions: {str(e)}")

@app.post("/api/admin/questions/batch")
async def add_questions_batch(question_batch: QuestionBatchCreate):
    batch = db.batch()
    try:
        question_week_id = question_batch.questions[0].week_id
        print(f"Checking and deleting existing questions of week {question_week_id}")
        
        # Firestore batch.delete() doesn't support queries. 
        # We must fetch the document references first.
        existing_qs = [doc async for doc in db.collection("questions").where("week_id", "==", question_week_id).stream()]
        for doc in existing_qs:
            batch.delete(doc.reference)

        print(f"Adding new questions to week {question_week_id}")
        for question in question_batch.questions:
            batch.set(db.collection("questions").document(question.id), {
                "text": question.text,
                "options": question.options,
                "correct_answer": question.answer,
                "order": question.order,
                "week_id": question.week_id
            })
        await batch.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/tester-submission/{user_id}")
async def delete_tester_submission(user_id: str, week_id: Optional[str] = None):
    """
    Delete a tester user's submission for a given week.
    Only works for users whose phone number is in the tester list.
    Resets their has_submitted status for that week.
    """
    # Check if user is a tester
    is_tester = await is_tester_phone(user_id)
    if not is_tester:
        raise HTTPException(
            status_code=403, 
            detail="This action is only allowed for tester phone numbers."
        )
    
    # Determine week
    target_week = week_id or await get_active_week_id()
    
    try:
        # Delete the submission document
        submission_ref = db.collection("users").document(user_id).collection("submissions").document(target_week)
        submission_doc = await submission_ref.get()
        
        if not submission_doc.exists:
            return {"status": "no_submission", "message": "No submission found for this week."}
        
        await submission_ref.delete()
        
        # Clear the has_submitted flag in user doc
        user_ref = db.collection("users").document(user_id)
        await user_ref.update({"has_submitted": False})
        
        # Invalidate leaderboard cache
        cache_key = f"weekly_{target_week}"
        if cache_key in leaderboard_cache:
            del leaderboard_cache[cache_key]
        if "overall" in leaderboard_cache:
            del leaderboard_cache["overall"]
        
        return {
            "status": "success", 
            "message": f"Deleted submission for {user_id} in week {target_week}."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# CORS
origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    # United89 URLs
    "https://united89-quiz-frontend-432448119899.asia-south2.run.app",
    "https://united89-quiz-backend-432448119899.asia-south2.run.app",
    "https://united89-club.web.app",
    # UCE URLs
    "https://uce-quiz-frontend-432448119899.asia-south2.run.app",
    "https://uce-quiz-backend-432448119899.asia-south2.run.app",
    "https://uce-quiz.web.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
