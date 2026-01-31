# Prompts module for AI agents
from .topics_agent import TOPICS_AGENT_SYSTEM_PROMPT, TOPICS_USER_PROMPT
from .quiz_agent import QUIZ_AGENT_SYSTEM_PROMPT, get_quiz_user_prompt, get_regenerate_prompt
from .legacy import SYSTEM_PROMPT

__all__ = [
    "TOPICS_AGENT_SYSTEM_PROMPT",
    "TOPICS_USER_PROMPT",
    "QUIZ_AGENT_SYSTEM_PROMPT",
    "get_quiz_user_prompt",
    "get_regenerate_prompt",
    "SYSTEM_PROMPT",
]
