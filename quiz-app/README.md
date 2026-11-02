# Quiz Show App

A full-stack MVP for a Quiz Show application using FastAPI, React, and Google Cloud Firestore.

## Project Structure

- `backend/`: FastAPI application (Python 3.14)
- `frontend/`: React application (Vite)

## Prerequisites

- Python 3.14+
- Node.js 18+
- Docker (optional)
- Google Cloud Service Account Credentials (JSON)

## Local Development Guide

### 1. Backend Setup (FastAPI + uv)

The backend uses `uv` for workspace dependency and virtual environment management (Python 3.14).

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```

2.  Sync dependencies and environment:
    ```bash
    # using uv (recommended - automatically creates .venv with Python 3.14 and installs locked deps)
    uv sync
    ```

3.  **Firestore Credentials**:
    Ensure you have your Google Cloud Service Account JSON file.
    Export the path to your credentials:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
    ```

4.  Run the server:
    ```bash
    # using uv
    uv run uvicorn main:app --reload --port 8080

    # OR after activating .venv (source .venv/bin/activate)
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
