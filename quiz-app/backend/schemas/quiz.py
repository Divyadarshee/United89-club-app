from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class SubmitAnswers(BaseModel):
    user_id: str
    week_id: str
    answers: Dict[str, str]
    time_taken: int

class QuizConfig(BaseModel):
    timer_duration_minutes: int
    question_count: Optional[int] = 10
    quiz_active: bool
    leaderboard_active: bool = False
    answers_visible: bool = False  # Controls when users can see correct answers
    tester_phones: List[str] = []  # Phone numbers that can bypass submission limit
    active_theme: str = "default"
    finale_mode: Optional[str] = "testers_only"  # 'testers_only' | 'public'

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
    week_id: str

class QuestionBatchCreate(BaseModel):
    questions: List[QuestionCreate]
