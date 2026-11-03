import sys
import os
import unittest

# Add backend directory to sys.path so imports work cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from schemas.quiz import QuizConfig, SubmitAnswers
from pydantic import ValidationError


class TestQuizConfig(unittest.TestCase):
    def test_default_quiz_config(self):
        """QuizConfig should have default question_count=10 and timer_duration_minutes=10"""
        config = QuizConfig(
            timer_duration_minutes=10,
            quiz_active=True
        )
        self.assertEqual(config.timer_duration_minutes, 10)
        self.assertEqual(config.question_count, 10)
        self.assertTrue(config.quiz_active)
        self.assertFalse(config.leaderboard_active)
        self.assertFalse(config.answers_visible)
        self.assertEqual(config.active_theme, "default")

    def test_custom_question_count_flexibility(self):
        """QuizConfig should support changing question_count to 20 or any number without breaking other fields"""
        config = QuizConfig(
            timer_duration_minutes=15,
            question_count=20,
            quiz_active=True,
            leaderboard_active=True,
            active_theme="independence_day"
        )
        self.assertEqual(config.question_count, 20)
        self.assertEqual(config.timer_duration_minutes, 15)
        self.assertTrue(config.quiz_active)
        self.assertTrue(config.leaderboard_active)
        self.assertEqual(config.active_theme, "independence_day")

    def test_validation_errors(self):
        """Invalid types should be rejected by Pydantic"""
        with self.assertRaises(ValidationError):
            # timer_duration_minutes must be an integer
            QuizConfig(
                timer_duration_minutes="not_a_number",
                quiz_active=True
            )


class TestSubmitAnswersSchema(unittest.TestCase):
    def test_submit_answers_valid(self):
        """SubmitAnswers schema should accept arbitrary question keys (q1 to q20) dynamically"""
        # Test with 10 questions
        data_10 = SubmitAnswers(
            user_id="9437555900",
            week_id="2026-W40",
            answers={f"q_{i}": f"opt_{i}" for i in range(1, 11)},
            time_taken=120
        )
        self.assertEqual(len(data_10.answers), 10)
        self.assertEqual(data_10.time_taken, 120)

        # Test with 20 questions
        data_20 = SubmitAnswers(
            user_id="9437555900",
            week_id="2026-W40",
            answers={f"q_{i}": f"opt_{i}" for i in range(1, 21)},
            time_taken=300
        )
        self.assertEqual(len(data_20.answers), 20)
        self.assertEqual(data_20.time_taken, 300)


if __name__ == '__main__':
    unittest.main()
