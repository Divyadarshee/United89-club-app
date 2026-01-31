import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const registerUser = async (name, phone) => {
    const response = await axios.post(`${API_URL}/api/register`, { name, phone });
    return response.data;
};

export const getQuestions = async (weekId = null, userId = null) => {
    const params = {};
    if (weekId) params.week_id = weekId;
    if (userId) params.user_id = userId;
    const response = await axios.get(`${API_URL}/api/questions`, { params });
    return response.data;
};

export const getConfig = async () => {
    const response = await axios.get(`${API_URL}/api/config`);
    return response.data;
};

export const submitAnswers = async (userId, answers, timeTaken, weekId) => {
    const response = await axios.post(`${API_URL}/api/submit`, {
        user_id: userId,
        answers,
        time_taken: timeTaken,
        week_id: weekId
    });
    return response.data;
};

// Public Leaderboard
export const getLeaderboard = async (type = 'weekly', weekId = null, admin = false) => {
    // Always ensure type has a value
    const safeType = type || 'weekly';
    const params = { type: safeType };
    if (weekId) params.week_id = weekId;
    if (admin) params.admin = true;

    console.log('[API] getLeaderboard called with params:', params);
    const response = await axios.get(`${API_URL}/api/leaderboard`, { params });
    console.log('[API] getLeaderboard response:', response.data?.length, 'items');
    return response.data;
};

// Admin Endpoints
export const getUsers = async () => {
    const response = await axios.get(`${API_URL}/api/admin/users`);
    return response.data;
};

export const getWeeks = async () => {
    const response = await axios.get(`${API_URL}/api/admin/weeks`);
    return response.data;
};

export const deleteQuestion = async (questionId) => {
    const response = await axios.delete(`${API_URL}/api/admin/questions/${questionId}`);
    return response.data;
};

export const addQuestion = async (questionData) => {
    const response = await axios.post(`${API_URL}/api/admin/questions`, questionData);
    return response.data;
};

export const updateConfig = async (configData) => {
    const response = await axios.post(`${API_URL}/api/admin/config`, configData);
    return response.data;
};

export const getAdminQuestions = async (weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await axios.get(`${API_URL}/api/admin/questions-full`, { params });
    return response.data;
};

export const generateQuestions = async (weekId) => {
    const response = await axios.post(`${API_URL}/api/admin/generate-questions`, null, {
        params: { week_id: weekId }
    });
    return response.data;
};

// ============================================
// NEW TWO-STEP QUESTION GENERATION APIs
// ============================================

/**
 * Step 1: Generate trending topics using Google Search
 * Returns a list of 10-15 trending topics from recent news
 */
export const generateTrendingTopics = async (weekId) => {
    const response = await axios.post(`${API_URL}/api/admin/generate-topics`, null, {
        params: { week_id: weekId }
    });
    return response.data;
};

/**
 * Step 2: Generate tiered quiz questions with selected trending topics
 * Returns questions organized by difficulty: easy (10), medium (6), hard (4)
 */
export const generateTieredQuestions = async (weekId, selectedTopics) => {
    const response = await axios.post(`${API_URL}/api/admin/generate-tiered-questions`, {
        week_id: weekId,
        selected_topics: selectedTopics
    });
    return response.data;
};

/**
 * Regenerate questions using agent memory with user feedback
 * Uses the same session to maintain context about selected topics
 */
export const regenerateQuestionsWithFeedback = async (weekId, sessionId, feedback) => {
    const response = await axios.post(`${API_URL}/api/admin/regenerate-questions`, {
        week_id: weekId,
        session_id: sessionId,
        feedback: feedback
    });
    return response.data;
};

export const addBatchQuestions = async (questions) => {
    const response = await axios.post(`${API_URL}/api/admin/questions/batch`, { questions });
    return response.data;
};

export const getSubmissionDetails = async (userId, weekId) => {
    const response = await axios.get(`${API_URL}/api/admin/submission/${userId}`, {
        params: { week_id: weekId }
    });
    return response.data;
};

// Public endpoint for users to view their own answers
export const getMySubmission = async (userId, weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await axios.get(`${API_URL}/api/my-submission/${userId}`, { params });
    return response.data;
};

// Admin: Delete tester submission
export const deleteTesterSubmission = async (userId, weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await axios.delete(`${API_URL}/api/admin/tester-submission/${userId}`, { params });
    return response.data;
};
