import random
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException
from core.database import db
from core.time_utils import get_current_iso_week
from schemas.quiz import SubmitAnswers
from services.phone_service import is_tester_phone
from services.user_service import get_active_week_id, get_answers_visible, get_user_doc_ref
from firebase_admin import firestore

router = APIRouter(prefix="/api", tags=["Quiz"])

# Global callback or event hook to invalidate leaderboard cache
_cache_invalidation_listeners = []

def register_cache_invalidation_listener(callback):
    _cache_invalidation_listeners.append(callback)

def invalidate_leaderboard_cache():
    for cb in _cache_invalidation_listeners:
        try:
            cb()
        except Exception:
            pass

@router.get("/questions")
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
        seed_str = f"{user_id}_{target_week}"
        seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (10**9)
        random.seed(seed)
        random.shuffle(public_questions)
        random.seed()  # Reset to default randomness
    
    return public_questions

@router.post("/submit")
async def submit(submission: SubmitAnswers):
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
        user_ref, user_doc = await get_user_doc_ref(submission.user_id)
        if not user_ref or not user_doc.exists:
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
        invalidate_leaderboard_cache()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submit Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"score": score}

@router.get("/my-submission/{user_id}")
async def get_my_submission(user_id: str, week_id: Optional[str] = None):
    """
    Public endpoint for users to view their own submission with question details.
    """
    try:
        target_week = week_id if week_id else await get_active_week_id()
        
        if target_week == "inactive":
            raise HTTPException(status_code=400, detail="No active quiz week")
        
        is_tester = await is_tester_phone(user_id)
        current_iso_week = get_current_iso_week()
        
        if is_tester or target_week < current_iso_week:
            answers_visible = True
        else:
            answers_visible = await get_answers_visible()
        
        user_ref, user_doc = await get_user_doc_ref(user_id)
        if not user_ref or not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
            
        sub_ref = user_ref.collection("submissions").document(target_week)
        sub_doc = await sub_ref.get()
        
        if not sub_doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        submission_data = sub_doc.to_dict()
        user_answers = submission_data.get("answers", {})
        
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
                "is_correct": user_answer == correct_answer if user_answer is not None else False,
            }
            
            if answers_visible:
                question_data["correct_answer"] = correct_answer
            
            questions_with_answers.append(question_data)
        
        return {
            "user_id": user_ref.id,
            "week_id": target_week,
            "score": submission_data.get("score", 0),
            "time_taken": submission_data.get("time_taken", 0),
            "questions": questions_with_answers,
            "answers_visible": answers_visible,
            "is_tester": is_tester
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
