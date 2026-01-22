# Quiz Challenge App

A monorepo for quiz challenge applications, supporting multiple deployments.

## Current Deployments

| Deployment | URL | Database |
|------------|-----|----------|
| United89 Club | `united89-club.web.app` | `first-firestore-db` |
| UCE (Ultimate Challenge Experience) | `uce-quiz.web.app` | `uce-db` |

## Current Applications

### 📚 Quiz App (`/quiz-app`)
A full-stack Quiz Show application. Built with:
- **Backend**: FastAPI (Python 3.11) with Google Cloud Firestore
- **Frontend**: React (Vite) with Tailwind CSS

See the [Quiz App README](./quiz-app/README.md) for detailed setup and development instructions.

## Future Roadmap

This repository is designed to house multiple quiz applications. Additional features and apps will be added here as they are developed.

## Project Structure

```
quiz-challenge-app/
├── .github/workflows/    # GitHub Actions for deployments
│   ├── cloud-run-deploy.yml      # United89 deployment
│   └── uce-cloud-run-deploy.yml  # UCE deployment
├── quiz-app/             # Quiz Show application
│   ├── backend/          # FastAPI backend
│   └── frontend/         # React frontend
└── README.md             # This file
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud Service Account Credentials (for Firestore)
- Docker (optional, for containerized deployment)