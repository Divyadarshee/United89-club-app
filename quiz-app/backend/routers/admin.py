from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from core.database import db
from core.time_utils import get_current_iso_week
from schemas.quiz import QuestionCreate, QuestionBatchCreate
from schemas.admin import WildcardEntry
from schemas.ai import GenerateQuestionsRequest, RegenerateQuestionsRequest
from services.phone_service import is_tester_phone
from services.user_service import get_active_week_id, get_user_doc_ref
from routers.leaderboard import clear_leaderboard_cache
from ai.genai import (
    generate_questions_by_ai,
    generate_trending_topics,
    generate_tiered_questions,
    regenerate_tiered_questions
)
from firebase_admin import firestore

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/weeks")
async def get_weeks():
    """Return list of weeks centered on current ISO week"""
    current = get_current_iso_week()
    weeks = []
    
    now = datetime.now()
    year, week, _ = now.isocalendar()
    
    for i in range(-2, 5): # 2 weeks back, 4 weeks forward
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

@router.get("/users")
async def get_all_users():
    """Returns all registered users with their name, phone, and current wildcard bonus info."""
    users_ref = db.collection("users")
    user_docs = [doc async for doc in users_ref.stream()]
    result = []
    for doc in user_docs:
        u = doc.to_dict()
        result.append({
            "user_id": doc.id,
            "name": u.get("name", "Unknown"),
            "phone": u.get("phone", doc.id),
            "cumulative_score": u.get("cumulative_score", 0),
            "weeks_played": u.get("weeks_played", 0),
            "bonus_points": u.get("bonus_points", 0),
            "bonus_weeks": u.get("bonus_weeks", 0),
            "bonus_reason": u.get("bonus_reason", None),
        })
    result.sort(key=lambda x: x["name"].lower())
    return result

@router.post("/questions")
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

@router.get("/questions-full")
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

@router.delete("/questions/{question_id}")
async def delete_question(question_id: str):
    await db.collection("questions").document(question_id).delete()
    return {"status": "deleted"}

@router.get("/submission/{user_id}")
async def get_user_submission(user_id: str, week_id: str):
    """Fetch a specific user's submission details for a given week"""
    try:
        user_ref, user_doc = await get_user_doc_ref(user_id)
        if not user_ref or not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")
        sub_ref = user_ref.collection("submissions").document(week_id)
        sub_doc = await sub_ref.get()
        
        if not sub_doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        data = sub_doc.to_dict()
        return {
            "user_id": user_ref.id,
            "week_id": week_id,
            "score": data.get("score", 0),
            "time_taken": data.get("time_taken", 0),
            "answers": data.get("answers", {})
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-questions")
async def generate_question(week_id: str, prompt: Optional[str] = None):
    """Legacy endpoint for generating questions (backward compatibility)"""
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > week_id:
        print(f"Trying to generate questions for past week ({week_id}). Current is {current_iso_week_id}")
        raise HTTPException(status_code=403, detail="Cannot generate questions for past weeks")

    return await generate_questions_by_ai(prompt)

@router.post("/generate-topics")
async def generate_topics_endpoint(week_id: str, prompt: Optional[str] = None):
    """
    Step 1: Generate trending topics using Google Search.
    Returns a list of 10-15 trending topics from recent news.
    """
    current_iso_week_id = get_current_iso_week()

    if current_iso_week_id > week_id:
        print(f"Trying to generate topics for past week ({week_id}). Current is {current_iso_week_id}")
        raise HTTPException(status_code=403, detail="Cannot generate topics for past weeks")

    try:
        topics = await generate_trending_topics(prompt)
        return {"topics": topics, "week_id": week_id}
    except Exception as e:
        print(f"Error generating topics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate topics: {str(e)}")

@router.post("/generate-tiered-questions")
async def generate_tiered_questions_endpoint(request: GenerateQuestionsRequest):
    """
    Step 2: Generate tiered quiz questions with selected trending topics.
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

@router.post("/regenerate-questions")
async def regenerate_questions_endpoint(request: RegenerateQuestionsRequest):
    """
    Regenerate quiz questions using agent memory.
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

@router.post("/questions/batch")
async def add_questions_batch(question_batch: QuestionBatchCreate):
    batch = db.batch()
    try:
        question_week_id = question_batch.questions[0].week_id
        print(f"Checking and deleting existing questions of week {question_week_id}")
        
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

@router.delete("/tester-submission/{user_id}")
async def delete_tester_submission(user_id: str, week_id: Optional[str] = None):
    """
    Delete a tester user's submission for a given week (or all weeks if week_id == 'all').
    """
    is_tester = await is_tester_phone(user_id)
    if not is_tester:
        raise HTTPException(
            status_code=403, 
            detail="This action is only allowed for tester phone numbers."
        )
    
    user_ref, user_doc = await get_user_doc_ref(user_id)
    if not user_ref or not user_doc.exists:
        return {"status": "no_user", "message": f"User document for {user_id} not found."}
    
    actual_user_id = user_ref.id
    target_week = week_id or await get_active_week_id()
    
    try:
        if target_week == "all":
            subs = [s async for s in user_ref.collection("submissions").stream()]
            deleted_count = 0
            for s in subs:
                await s.reference.delete()
                deleted_count += 1
            
            await user_ref.update({
                "has_submitted": False,
                "submitted": False,
                "cumulative_score": 0,
                "cumulative_time": 0,
                "weeks_played": 0
            })
            clear_leaderboard_cache()
            return {
                "status": "success",
                "message": f"Deleted all {deleted_count} submissions for tester {actual_user_id} and reset stats."
            }
        else:
            submission_ref = user_ref.collection("submissions").document(target_week)
            submission_doc = await submission_ref.get()
            
            if not submission_doc.exists:
                return {"status": "no_submission", "message": f"No submission found for week {target_week}."}
            
            sub_data = submission_doc.to_dict()
            old_score = sub_data.get("score", 0)
            old_time = sub_data.get("time_taken", 0)
            
            await submission_ref.delete()
            
            remaining_subs = [s async for s in user_ref.collection("submissions").stream()]
            update_data = {
                "has_submitted": False,
                "cumulative_score": firestore.Increment(-old_score),
                "cumulative_time": firestore.Increment(-old_time),
                "weeks_played": firestore.Increment(-1)
            }
            if len(remaining_subs) == 0:
                update_data["submitted"] = False
                update_data["cumulative_score"] = 0
                update_data["cumulative_time"] = 0
                update_data["weeks_played"] = 0
                
            await user_ref.update(update_data)
            clear_leaderboard_cache()
            return {
                "status": "success", 
                "message": f"Deleted submission for {actual_user_id} in week {target_week}."
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wildcard")
async def grant_wildcard(entry: WildcardEntry):
    """
    Grant a wildcard contestant bonus points and weeks on the overall leaderboard.
    """
    user_id = entry.phone
    user_ref = db.collection("users").document(user_id)
    
    try:
        user_doc = await user_ref.get()
        if not user_doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"User with phone '{user_id}' not found. Make sure they have registered."
            )
        
        user_data = user_doc.to_dict()
        
        await user_ref.update({
            "bonus_points": entry.bonus_points,
            "bonus_weeks": entry.bonus_weeks,
            "bonus_reason": entry.reason,
            "bonus_granted_at": firestore.SERVER_TIMESTAMP
        })
        
        clear_leaderboard_cache()
        
        return {
            "status": "success",
            "user_id": user_id,
            "name": user_data.get("name", "Unknown"),
            "bonus_points": entry.bonus_points,
            "bonus_weeks": entry.bonus_weeks,
            "reason": entry.reason,
            "message": f"Wildcard bonus granted to {user_data.get('name', user_id)}: +{entry.bonus_points} pts, +{entry.bonus_weeks} weeks displayed."
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Wildcard Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
