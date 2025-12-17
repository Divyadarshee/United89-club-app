# United89 Club App

A monorepo for the United89 Club applications.

## Current Applications

### 📚 Quiz App (`/quiz-app`)
A full-stack Quiz Show application for United89 club members. Built with:
- **Backend**: FastAPI (Python 3.11) with Google Cloud Firestore
- **Frontend**: React (Vite) with Tailwind CSS

See the [Quiz App README](./quiz-app/README.md) for detailed setup and development instructions.

## Future Roadmap

This repository is designed to house multiple applications for the United89 Club. Additional features and apps will be added here as they are developed.

## Project Structure

```
United89-club-app/
├── quiz-app/           # Quiz Show application
│   ├── backend/        # FastAPI backend
│   └── frontend/       # React frontend
└── README.md           # This file
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud Service Account Credentials (for Firestore)
- Docker (optional, for containerized deployment)