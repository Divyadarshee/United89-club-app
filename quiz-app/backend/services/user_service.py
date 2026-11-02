from fastapi import HTTPException

from core.database import db
from core.time_utils import get_current_utc_time, get_current_iso_week
from services.phone_service import normalize_phone, is_tester_phone
from firebase_admin import firestore
from typing import Optional, Dict, Any, Tuple

async def get_active_week_id() -> str:
    """
    Determines the PREFERRED active week.
    1. Checks if there is a week explicitly scheduled for NOW in 'weeks' collection.
    2. If not, falls back to calendar week.
    """
    iso_week = get_current_iso_week()
    week_doc = await db.collection("weeks").document(iso_week).get()
    
    if week_doc.exists:
        data = week_doc.to_dict()
        if data.get("is_active") is False:
            return "inactive" # Explicitly disabled
            
    return iso_week

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

async def get_user_doc_ref(user_id: str):
    """Find user document reference by user_id or normalized phone"""
    # 1. Try direct ID
    ref = db.collection("users").document(user_id)
    doc = await ref.get()
    if doc.exists:
        return ref, doc
    
    # 2. Try with/without +91
    norm = normalize_phone(user_id)
    alternatives = [f"+91{norm}", norm, f"91{norm}"]
    for alt in alternatives:
        if alt != user_id:
            ref = db.collection("users").document(alt)
            doc = await ref.get()
            if doc.exists:
                return ref, doc
                
    # 3. Query by phone field
    users_query = db.collection("users").where("phone", "in", alternatives)
    docs = [d async for d in users_query.stream()]
    if docs:
        return docs[0].reference, docs[0]
        
    return None, None

async def get_or_create_user(phone: str, name: Optional[str] = None, google_email: Optional[str] = None) -> Tuple[Dict[str, Any], bool, str]:
    """
    Retrieves existing user or creates a new one in Firestore.
    Returns: (user_data, has_submitted_this_week, active_week_id)
    """
    ref, doc = await get_user_doc_ref(phone)
    week_id = await get_active_week_id()
    is_tester = await is_tester_phone(phone)
    has_submitted_this_week = False

    if doc and doc.exists:
        user_data = doc.to_dict()
        # Update name if new name provided
        if name and user_data.get("name") != name:
            await ref.update({"name": name})
            user_data["name"] = name
        # Update email if new email provided
        if google_email:
            clean_email = google_email.strip().lower()
            existing_email = (user_data.get("email") or "").strip().lower()
            if existing_email and existing_email != clean_email:
                masked = _mask_email(existing_email)
                raise HTTPException(
                    status_code=403,
                    detail=f"This phone number is already linked to {masked}. Please sign in with that Google account, or sign in via SMS OTP to update your email in Profile."
                )
            if not existing_email:
                await ref.update({"email": clean_email, "updated_at": firestore.SERVER_TIMESTAMP})
                user_data["email"] = clean_email
        else:
            user_data.setdefault("email", "")
            
        # Check sub-collection for this week's submission
        sub_ref = ref.collection("submissions").document(week_id)
        sub_doc = await sub_ref.get()
        if sub_doc.exists:
            has_submitted_this_week = True
            
        if is_tester:
            has_submitted_this_week = False

        return user_data, has_submitted_this_week, week_id

    # Create new user
    user_id = phone
    clean_new_email = google_email.strip().lower() if google_email else ""
    user_data = {
        "user_id": user_id,
        "name": name or "Club Member",
        "phone": phone,
        "email": clean_new_email,
        "batch": "1989",
        "city": "",
        "bio": "Alumni & Quiz Enthusiast",
        "avatar": "avatar-1",
        "cumulative_score": 0,
        "cumulative_time": 0,
        "weeks_played": 0,
        "created_at": firestore.SERVER_TIMESTAMP
    }
    
    doc_ref = db.collection("users").document(user_id)
    await doc_ref.set(user_data)
    return user_data, False, week_id

async def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Fetch complete user profile, submission history, and live leaderboard stats"""
    ref, doc = await get_user_doc_ref(user_id)
    if not doc or not doc.exists:
        return {
            "user_id": user_id,
            "phone": user_id,
            "email": "",
            "name": "Club Member",
            "batch": "1989",
            "city": "",
            "bio": "",
            "avatar": "avatar-1",
            "cumulative_score": 0,
            "weeks_played": 0,
            "rank": "#--",
            "badges": ["Verified Member"],
            "submissions_history": []
        }
    
    data = doc.to_dict()
    data.setdefault("user_id", doc.id)
    data.setdefault("phone", doc.id)
    data.setdefault("email", "")
    data.setdefault("name", "Club Member")
    data.setdefault("batch", "1989")
    data.setdefault("city", "")
    data.setdefault("bio", "")
    data.setdefault("avatar", "avatar-1")

    # Fetch user's weekly quiz submissions
    submissions_history = []
    sub_score_sum = 0
    sub_time_sum = 0
    try:
        subs_stream = ref.collection("submissions").stream()
        async for sub_doc in subs_stream:
            s_data = sub_doc.to_dict()
            w_id = s_data.get("week_id", sub_doc.id)
            score_val = s_data.get("score", 0) or 0
            time_val = s_data.get("time_taken", 0) or 0
            sub_score_sum += score_val
            sub_time_sum += time_val
            submissions_history.append({
                "week_id": w_id,
                "score": score_val,
                "time_taken": time_val
            })
        submissions_history.sort(key=lambda x: x["week_id"], reverse=True)
    except Exception as e:
        print(f"Error fetching user submissions for profile: {e}")

    bonus_points = data.get("bonus_points", 0) or 0
    bonus_weeks = data.get("bonus_weeks", 0) or 0

    computed_score = max(data.get("cumulative_score", 0) or 0, sub_score_sum) + bonus_points
    computed_weeks = max(data.get("weeks_played", 0) or 0, len(submissions_history)) + bonus_weeks

    data["cumulative_score"] = computed_score
    data["weeks_played"] = computed_weeks
    data["submissions_history"] = submissions_history

    # Calculate live standing rank among players with points/submissions
    rank_str = "#--"
    if computed_weeks > 0 or computed_score > 0:
        try:
            users_stream = db.collection("users").stream()
            standings = []
            async for u_doc in users_stream:
                u_dict = u_doc.to_dict()
                u_score = (u_dict.get("cumulative_score", 0) or 0) + (u_dict.get("bonus_points", 0) or 0)
                u_weeks = (u_dict.get("weeks_played", 0) or 0) + (u_dict.get("bonus_weeks", 0) or 0)
                u_time = u_dict.get("cumulative_time", 0) or 0
                if u_doc.id == doc.id:
                    u_score = computed_score
                    u_weeks = computed_weeks
                if u_weeks > 0 or u_score > 0:
                    standings.append((u_doc.id, u_score, u_time))
            standings.sort(key=lambda item: (-item[1], item[2]))
            for idx, (uid, _, _) in enumerate(standings):
                if uid == doc.id:
                    rank_str = f"#{idx + 1}"
                    break
        except Exception as e:
            print(f"Error computing profile rank: {e}")

    data["rank"] = rank_str

    # Compute dynamic badges
    badges = ["Verified Member"]
    if computed_weeks >= 1:
        badges.append("Challenger")
    if computed_weeks >= 3:
        badges.append("Quiz Veteran")
    if bonus_points > 0:
        badges.append("Wildcard Winner")
    if rank_str in ("#1", "#2", "#3"):
        badges.append(f"Top 3 ({rank_str})")
    data["badges"] = badges

    # Ensure timestamps are JSON-safe strings if present
    for ts_field in ("created_at", "updated_at"):
        if ts_field in data and hasattr(data[ts_field], "isoformat"):
            data[ts_field] = data[ts_field].isoformat()

    return data

async def update_user_profile(user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Updates allowed profile fields for a user"""
    ref, doc = await get_user_doc_ref(user_id)
    if not ref:
        ref = db.collection("users").document(user_id)
    
    # Filter only permitted fields
    allowed_fields = {"name", "batch", "city", "bio", "avatar", "email"}
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    if "email" in filtered_updates and isinstance(filtered_updates["email"], str):
        filtered_updates["email"] = filtered_updates["email"].strip().lower()
    
    if filtered_updates:
        filtered_updates["updated_at"] = firestore.SERVER_TIMESTAMP
        await ref.update(filtered_updates)
    
    return await get_user_profile(user_id)


def _mask_email(email: str) -> str:
    """Masks 'divyadarshee@gmail.com' -> 'di***e@gmail.com' for safe error messages"""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[:2]}***{local[-1]}@{domain}"


async def verify_or_bind_google_email(phone: str, google_email: str) -> bool:
    """
    Option A (First-Login Lock):
    - If user has no linked email yet, binds google_email to their user document.
    - If user already has a linked email, verifies it matches (case-insensitive).
    - If it does not match, raises 403 instructing them to use that account or login via SMS to change it.
    """

    clean_email = google_email.strip().lower()
    ref, doc = await get_user_doc_ref(phone)

    if doc and doc.exists:
        data = doc.to_dict()
        existing_email = (data.get("email") or "").strip().lower()
        if existing_email and existing_email != clean_email:
            masked = _mask_email(existing_email)
            raise HTTPException(
                status_code=403,
                detail=f"This phone number is already linked to {masked}. Please sign in with that Google account, or sign in via SMS OTP to update your email in Profile."
            )
        if not existing_email:
            await ref.update({"email": clean_email, "updated_at": firestore.SERVER_TIMESTAMP})
