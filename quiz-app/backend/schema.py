from pydantic import BaseModel, Field
from typing import List, Literal


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

class QuizQuestions(BaseModel):
    question_sets: List[QuizQuestion] = Field(
        description="List of quiz questions"
    )