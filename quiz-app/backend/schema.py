from pydantic import BaseModel, Field
from typing import List, Literal, Optional


# ============================================
# API REQUEST SCHEMAS
# ============================================

class GenerateQuestionsRequest(BaseModel):
    """Request body for generating tiered questions"""
    week_id: str
    selected_topics: List[str]


class RegenerateQuestionsRequest(BaseModel):
    """Request body for regenerating questions with feedback"""
    week_id: str
    session_id: str
    feedback: str


# ============================================
# TRENDING TOPICS SCHEMA (Step 1)
# ============================================

class TrendingTopic(BaseModel):
    topic: str = Field(
        description="The trending topic name (e.g., 'Union Budget 2026', 'Champions Trophy 2026')"
    )
    description: str = Field(
        description="A brief 1-2 sentence description of the topic and why it's trending"
    )

class TrendingTopics(BaseModel):
    topics: List[TrendingTopic] = Field(
        description="List of 10-15 trending topics from recent news and events in India",
        min_length=8,
        max_length=15
    )


# ============================================
# QUIZ QUESTIONS SCHEMA (Step 2 - Tiered)
# ============================================

class QuizQuestion(BaseModel):
    question: str = Field(
        description="Quiz question"
    )
    choices: List[str] = Field(
        description="List of 4 options which are possible answers to the question in the `question` field, with one of them being the actual answer"
    )
    correct_answer: Literal['a', 'b', 'c', 'd'] = Field(
        description="Correct option out of the 4 choices given in `choices` field. It has to be one of these 4 characters - 'a', 'b', 'c', 'd'.",
        min_length=1,
        max_length=1,
        pattern=r"^[a-z]$"
    )
    category: str = Field(
        description="Category of the question: 'current_affairs', 'pop_culture', 'history_heritage', 'world_geography', 'science_technology', or 'miscellaneous'"
    )

class TieredQuizQuestions(BaseModel):
    """
    Tiered quiz questions organized by difficulty.
    Admin selects: 5 easy + 3 medium + 2 hard = 10 final questions
    """
    easy_questions: List[QuizQuestion] = Field(
        description="10 easy questions - well-known facts that most educated adults would know with minimal thinking",
        min_length=10,
        max_length=10
    )
    medium_questions: List[QuizQuestion] = Field(
        description="6 medium questions - require connecting facts or slightly deeper knowledge",
        min_length=6,
        max_length=6
    )
    hard_questions: List[QuizQuestion] = Field(
        description="4 hard questions - challenging questions that require specialized knowledge or connecting multiple concepts",
        min_length=4,
        max_length=4
    )


# ============================================
# LEGACY SCHEMA (for backward compatibility)
# ============================================

class QuizQuestions(BaseModel):
    question_sets: List[QuizQuestion] = Field(
        description="List of quiz questions"
    )