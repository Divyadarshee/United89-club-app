# Quiz Show App

A full-stack MVP for a Quiz Show application using FastAPI, React, and Google Cloud Firestore.

## Project Structure

- `backend/`: FastAPI application (Python 3.11)
- `frontend/`: React application (Vite)

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (optional)
- Google Cloud Service Account Credentials (JSON)

## Local Development Guide

### 1. Backend Setup (FastAPI + uv)

The backend uses `uv` for fast package management, but regular `pip` works too.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment:
    ```bash
    # using uv (recommended)
    uv venv
    
    # OR using standard python
    python -m venv .venv
    ```

3.  Activate the environment:
    ```bash
    # macOS/Linux
    source .venv/bin/activate
    
    # Windows
    .venv\Scripts\activate
    ```

4.  Install dependencies:
    ```bash
    # using uv
    uv pip install -r requirements.txt
    
    # OR using standard pip
    pip install -r requirements.txt
    ```

5.  **Firestore Credentials**:
    Ensure you have your Google Cloud Service Account JSON file.
    Export the path to your credentials:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
    ```

6.  Run the server:
    ```bash
    uvicorn main:app --reload --port 8080
    ```
    The API will be available at `http://localhost:8080`.

### 2. Frontend Setup (React + Vite)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

## Docker Deployment

### Backend
```bash
cd backend
docker build -t quiz-backend .
docker run -p 8080:8080 -e GOOGLE_APPLICATION_CREDENTIALS=/app/key.json -v /path/to/key.json:/app/key.json quiz-backend
```

### Frontend
```bash
cd frontend
docker build -t quiz-frontend .
docker run -p 80:80 quiz-frontend
```

## Firestore Data Structure
The application automatically creates/updates documents in the `users` collection.
- `user_id`: UUID
- `name`: String
- `phone`: String
- `score`: Number
- `answers`: Map
