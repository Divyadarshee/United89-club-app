# Backwards compatibility re-export
from schemas.ai import (
    GenerateQuestionsRequest,
    RegenerateQuestionsRequest,
    TrendingTopic,
    TrendingTopics,
    QuizQuestion,
    TieredQuizQuestions,
    QuizQuestions
)
from schemas.auth import SendOtpRequest, VerifyOtpRequest, RefreshRequest, TokenResponse, UserRegister
from schemas.profile import ProfileUpdateRequest, ProfileResponse
from schemas.quiz import SubmitAnswers, QuizConfig, WeekConfig, QuestionCreate, QuestionBatchCreate
from schemas.admin import WildcardEntry
