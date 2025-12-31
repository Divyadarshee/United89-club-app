#!/bin/bash

# Cloud Run Deployment Script
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

PROJECT_ID=$1
REGION=${2:-us-central1}

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy.sh [PROJECT_ID] [REGION]"
    echo "Example: ./deploy.sh my-quiz-project us-central1"
    exit 1
fi

echo "Deploying to Project: $PROJECT_ID in Region: $REGION"

# 1. Enable Services (Optional but good practice)
# gcloud services enable run.googleapis.com containerregistry.googleapis.com --project $PROJECT_ID

# 2. Deploy Backend
echo "========================================"
echo "Building and Deploying Backend..."
echo "========================================"
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/united89-quiz-backend
gcloud run deploy united89-quiz-backend \
    --image gcr.io/$PROJECT_ID/united89-quiz-backend \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars DB_NAME=first-firestore-db

# Get Backend URL
BACKEND_URL=$(gcloud run services describe united89-quiz-backend --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID)
echo "Backend deployed at: $BACKEND_URL"

# 3. Deploy Frontend
echo "========================================"
echo "Building and Deploying Frontend..."
echo "========================================"
cd ../frontend

# Create a temporary cloudbuild.yaml to pass build args
cat > cloudbuild.yaml <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '--build-arg', 'VITE_API_URL=$_API_URL', '-t', 'gcr.io/$PROJECT_ID/united89-quiz-frontend', '.']
images:
- 'gcr.io/$PROJECT_ID/united89-quiz-frontend'
EOF

gcloud builds submit --config cloudbuild.yaml --substitutions=_API_URL=$BACKEND_URL
rm cloudbuild.yaml

echo "Deploying Frontend Service..."
gcloud run deploy united89-quiz-frontend \
    --image gcr.io/$PROJECT_ID/united89-quiz-frontend \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 80

echo "Deployment Complete!"
echo "Backend: $BACKEND_URL"
echo "Frontend: $(gcloud run services describe united89-quiz-frontend --platform managed --region $REGION --format 'value(status.url)' --project $PROJECT_ID)"
