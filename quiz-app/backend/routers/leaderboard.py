import time
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException
from core.database import db
from core.config import CACHE_TTL
from services.phone_service import get_tester_phones_set, normalize_phone
from services.user_service import get_active_week_id
from routers.quiz import register_cache_invalidation_listener
from firebase_admin import firestore

router = APIRouter(prefix="/api", tags=["Leaderboard"])

# Leaderboard in-memory cache
leaderboard_cache: Dict[str, tuple[list, float]] = {}

def clear_leaderboard_cache():
    global leaderboard_cache
    leaderboard_cache = {}

# Register cache clearer with quiz router
register_cache_invalidation_listener(clear_leaderboard_cache)

@router.get("/leaderboard")
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
        tester_phones = await get_tester_phones_set()
        
        if type == "overall":
            # For overall leaderboard, calculate aggregates EXCLUDING the current week
            users_ref = db.collection("users").where("submitted", "==", True)
            user_docs = [doc async for doc in users_ref.stream()]
            
            all_submitted_weeks = set()
            
            for user_doc in user_docs:
                u = user_doc.to_dict()
                user_id = user_doc.id
                
                # Exclude testers from overall leaderboard
                if normalize_phone(user_id) in tester_phones or normalize_phone(u.get("phone", "")) in tester_phones:
                    continue
                
                # Get all submissions for this user EXCEPT current week
                submissions_ref = db.collection("users").document(user_id).collection("submissions")
                subs = [sub async for sub in submissions_ref.stream()]
                
                total_score = 0
                total_time = 0
                weeks_count = 0
                
                for sub in subs:
                    s_data = sub.to_dict()
                    sub_week = s_data.get("week_id", "")
                    
                    if (exclude_current_in_overall and sub_week == current_week) or (sub_week in ["2026-W04"]):
                        continue
                    
                    all_submitted_weeks.add(sub_week)
                    total_score += s_data.get("score", 0)
                    total_time += s_data.get("time_taken", 0)
                    weeks_count += 1
                
                bonus_points = u.get("bonus_points", 0)
                bonus_weeks = u.get("bonus_weeks", 0)
                if weeks_count == 0 and bonus_points == 0:
                    continue
                
                avg_time = round(total_time / weeks_count) if weeks_count > 0 else 0
                
                users_list.append({
                    "user_id": user_id,
                    "name": u.get("name", "Unknown"),
                    "score": total_score + bonus_points,
                    "avg_time": avg_time,
                    "weeks_played": weeks_count + bonus_weeks,
                    "week_id": "All-Time",
                    "has_wildcard": bonus_points > 0,
                    "bonus_reason": u.get("bonus_reason", None) if bonus_points > 0 else None
                })
            
            # Get all unique week IDs from questions
            questions_ref = db.collection("questions").select(["week_id"])
            q_docs = [doc async for doc in questions_ref.stream()]
            quiz_weeks = {doc.to_dict().get("week_id") for doc in q_docs if doc.to_dict().get("week_id")}
            
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
            
            users_list.sort(key=lambda x: (-x["score"], x["avg_time"]))
        else:
            # Weekly Leaderboard
            fetch_limit = 50 + len(tester_phones) * 5
            submissions_query = (
                db.collection_group("submissions")
                .where("week_id", "==", target_week)
                .order_by("score", direction=firestore.Query.DESCENDING)
                .order_by("time_taken", direction=firestore.Query.ASCENDING)
                .limit(fetch_limit)
            )
            
            subs = [sub async for sub in submissions_query.stream()]
            
            for sub in subs:
                s_data = sub.to_dict()
                user_id = sub.reference.parent.parent.id if sub.reference.parent.parent else None
                
                if user_id and normalize_phone(user_id) in tester_phones:
                    continue
                
                name = s_data.get("user_name", "Unknown")
                
                users_list.append({
                    "user_id": user_id,
                    "name": name,
                    "score": None if is_current_week else s_data.get("score", 0),
                    "time_taken": s_data.get("time_taken", 0),
                    "week_id": target_week,
                    "is_current_week": is_current_week
                })

        if type == "weekly":
            users_list = users_list[:50]

        for i, u in enumerate(users_list):
            u['rank'] = i + 1
            
        leaderboard_cache[cache_key] = (users_list, current_time)
        return users_list
        
    except Exception as e:
        print(f"LB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
