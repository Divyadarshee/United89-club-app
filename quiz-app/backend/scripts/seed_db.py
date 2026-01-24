import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase
try:
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
             cred = credentials.Certificate(cred_path)
             firebase_admin.initialize_app(cred)
        else:
             firebase_admin.initialize_app()
except Exception as e:
    print(f"Failed to initialize Firebase: {e}")
    exit(1)

DB_NAME = os.getenv("DB_NAME")
db = firestore.Client(database=DB_NAME)

QUESTIONS = [
    {
        "id": "q1",
        "text": "What is the capital of France?",
        "options": ["London", "Berlin", "Paris", "Madrid"],
        "answer": "Paris",
        "order": 1
    },
    {
        "id": "q2",
        "text": "Which planet is known as the Red Planet?",
        "options": ["Earth", "Mars", "Jupiter", "Venus"],
        "answer": "Mars",
        "order": 2
    },
    {
        "id": "q3",
        "text": "What is the largest ocean on Earth?",
        "options": ["Atlantic", "Indian", "Arctic", "Pacific"],
        "answer": "Pacific",
        "order": 3
    },
    {
        "id": "q4",
        "text": "Who wrote 'Romeo and Juliet'?",
        "options": ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"],
        "answer": "William Shakespeare",
        "order": 4
    },
    {
        "id": "q5",
        "text": "What is the chemical symbol for Gold?",
        "options": ["Au", "Ag", "Fe", "Pb"],
        "answer": "Au",
        "order": 5
    }
]

def seed_data():
    print(f"Seeding database: {DB_NAME}...")

    # Seed Config
    print("Setting up quiz settings...")
    db.collection("config").document("quiz_settings").set({
        "timer_duration_minutes": 10,
        "quiz_active": True
    })

    # Seed Questions
    print("Seeding questions...")
    
    # Get current week ID for seeding
    from datetime import datetime
    now = datetime.now()
    current_week_id = f"{now.year}-W{now.isocalendar()[1]:02d}"
    print(f"Assigning questions to week: {current_week_id}")

    batch = db.batch()
    for q in QUESTIONS:
        doc_ref = db.collection("questions").document(q["id"])
        batch.set(doc_ref, {
            "text": q["text"],
            "options": q["options"],
            "correct_answer": q["answer"],
            "order": q["order"],
            "week_id": current_week_id  # Add week_id
        })
    batch.commit()
    print("Seeding complete!")

if __name__ == "__main__":
    seed_data()
