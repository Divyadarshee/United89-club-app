import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const registerUser = async (name, phone) => {
    const response = await axios.post(`${API_URL}/api/register`, { name, phone });
    return response.data;
};

export const getQuestions = async () => {
    const response = await axios.get(`${API_URL}/api/questions`);
    return response.data;
};

export const getConfig = async () => {
    const response = await axios.get(`${API_URL}/api/config`);
    return response.data;
};

export const submitAnswers = async (userId, answers, timeTaken) => {
    const response = await axios.post(`${API_URL}/api/submit`, { user_id: userId, answers, time_taken: timeTaken });
    return response.data;
};

// Public Leaderboard
export const getLeaderboard = async () => {
    const response = await axios.get(`${API_URL}/api/leaderboard`);
    return response.data;
};

// Admin Endpoints
export const getUsers = async () => {
    const response = await axios.get(`${API_URL}/api/admin/users`);
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

export const getAdminQuestions = async () => {
    const response = await axios.get(`${API_URL}/api/admin/questions-full`);
    return response.data;
};
