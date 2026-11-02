from pydantic import BaseModel
from typing import Optional

class WildcardEntry(BaseModel):
    phone: str                  # The user's phone number (used as user_id)
    bonus_points: int           # Extra points to award on overall leaderboard
    bonus_weeks: int            # Extra weeks to show as played on overall leaderboard
    reason: Optional[str] = "Wildcard Entry"  # Audit trail
