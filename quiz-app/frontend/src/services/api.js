import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Configured Axios instance with auto-token injection and token refresh interceptor
const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 1. Request Interceptor: Attach Bearer Access Token to every request if present
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. Response Interceptor: Handle 401 Unauthorized via Silent Refresh (Access 15m + Refresh 15d)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 (token expired) and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            const refreshToken = localStorage.getItem('refresh_token');

            // If we don't even have a refresh token, we can't refresh
            if (!refreshToken) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // If another request is already refreshing the token, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return apiClient(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call backend refresh endpoint
                const res = await axios.post(`${API_URL}/api/auth/refresh`, {
                    refresh_token: refreshToken
                });

                const { access_token, refresh_token: newRefreshToken } = res.data;
                localStorage.setItem('access_token', access_token);
                if (newRefreshToken) {
                    localStorage.setItem('refresh_token', newRefreshToken);
                }

                apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                originalRequest.headers.Authorization = `Bearer ${access_token}`;

                processQueue(null, access_token);
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Refresh token is expired or revoked - clear tokens and force re-login
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.dispatchEvent(new Event('auth:logout'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// ============================================
// AUTH & OTP ENDPOINTS
// ============================================

/**
 * Exchange Firebase Auth ID token (Phone SMS or Google Sign-In) for custom 15m Access + 15d Refresh tokens
 */
export const loginWithFirebase = async (idToken, name = '', phone = '') => {
    const response = await apiClient.post('/api/auth/firebase-login', {
        id_token: idToken,
        name,
        phone
    });
    return response.data;
};

/**
 * Admin: Send OTP (Restricted to 9437555900)
 */
export const sendAdminOtp = async (phone) => {
    const response = await apiClient.post('/api/auth/admin/send-otp', { phone });
    return response.data;
};

/**
 * Admin: Verify OTP & get admin access
 */
export const verifyAdminOtp = async (phone, otp) => {
    const response = await apiClient.post('/api/auth/admin/verify-otp', { phone, otp });
    return response.data;
};

/**
 * Step 1 of Login: Request an OTP to be sent to user's phone number
 */
export const sendOtp = async (phone, name = '') => {
    try {
        const response = await apiClient.post('/api/auth/send-otp', { phone, name });
        return response.data;
    } catch (err) {
        // Fallback for development if backend OTP endpoint is not yet connected
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            console.warn('[AUTH] /api/auth/send-otp endpoint not found on backend. Falling back to dev simulation.');
            return {
                status: 'simulated',
                message: 'Development Mode: Use OTP 123456 to verify.',
                debug_otp: '123456'
            };
        }
        throw err;
    }
};

/**
 * Step 2 of Login: Verify OTP code and receive Access + Refresh tokens
 */
export const verifyOtp = async (phone, otp, name = '') => {
    try {
        const response = await apiClient.post('/api/auth/verify-otp', { phone, otp, name });
        return response.data;
    } catch (err) {
        // Fallback for development if backend OTP endpoint is not yet connected
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            if (otp === '123456') {
                console.warn('[AUTH] Dev mode OTP matched! Generating simulated local session.');
                // Call legacy register endpoint or simulate tokens
                let legacyData = { user_id: phone, has_submitted: false, week_id: 'week_active' };
                try {
                    legacyData = await registerUser(name || 'Alumni Member', phone);
                } catch {
                    // ignore if backend offline
                }

                // Simulated tokens (15m and 15d)
                const mockAccessToken = `dev_access_${phone}_${Date.now()}`;
                const mockRefreshToken = `dev_refresh_${phone}_${Date.now()}`;

                return {
                    access_token: mockAccessToken,
                    refresh_token: mockRefreshToken,
                    token_type: 'bearer',
                    has_submitted: legacyData.has_submitted || false,
                    week_id: legacyData.week_id,
                    user: {
                        user_id: phone,
                        phone: phone,
                        name: name || 'Alumni Member',
                        batch: '1987',
                        city: 'Bhubaneswar, India',
                        bio: 'Proud United87 Alumni & Quiz Enthusiast',
                        avatar: 'avatar-1',
                        cumulative_score: 45,
                        weeks_played: 6,
                        rank: '#4'
                    }
                };
            }
            throw new Error('Invalid OTP. In dev mode, enter 123456');
        }
        throw err;
    }
};

/**
 * Explicit refresh token call
 */
export const refreshAccessToken = async (refreshToken) => {
    const response = await apiClient.post('/api/auth/refresh', {
        refresh_token: refreshToken
    });
    return response.data;
};

// ============================================
// PROFILE ENDPOINTS
// ============================================

/**
 * Fetch current authenticated user's profile details & quiz stats
 */
export const getMyProfile = async () => {
    try {
        const response = await apiClient.get('/api/profile/me');
        return response.data;
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            // Mock profile fallback for frontend development preview
            const savedProfile = localStorage.getItem('dev_user_profile');
            if (savedProfile) return JSON.parse(savedProfile);

            const phone = localStorage.getItem('user_id') || '+91 94375 55900';
            return {
                user_id: phone,
                phone: phone,
                name: 'Divyadarshee Das',
                batch: '1987',
                city: 'Bhubaneswar, India',
                bio: 'UCE87 batch alumnus & trivia enthusiast.',
                avatar: 'avatar-1',
                cumulative_score: 120,
                weeks_played: 8,
                rank: '#3',
                badges: ['Top 5', 'Veteran', 'Perfect Score Week 12']
            };
        }
        throw err;
    }
};

/**
 * Update current authenticated user's profile details
 */
export const updateMyProfile = async (profileData) => {
    try {
        const response = await apiClient.put('/api/profile/me', profileData);
        return response.data;
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            // Save locally in dev fallback mode
            const current = await getMyProfile();
            const updated = { ...current, ...profileData };
            localStorage.setItem('dev_user_profile', JSON.stringify(updated));
            return { status: 'success', user: updated };
        }
        throw err;
    }
};

// ============================================
// EXISTING APP ENDPOINTS (Backwards Compatible)
// ============================================

export const registerUser = async (name, phone) => {
    const response = await apiClient.post('/api/register', { name, phone });
    return response.data;
};

export const getQuestions = async (weekId = null, userId = null) => {
    const params = {};
    if (weekId) params.week_id = weekId;
    if (userId) params.user_id = userId;
    const response = await apiClient.get('/api/questions', { params });
    return response.data;
};

export const getConfig = async () => {
    const response = await apiClient.get('/api/config');
    return response.data;
};

export const submitAnswers = async (userId, answers, timeTaken, weekId) => {
    const response = await apiClient.post('/api/submit', {
        user_id: userId,
        answers,
        time_taken: timeTaken,
        week_id: weekId
    });
    return response.data;
};

// Public Leaderboard
export const getLeaderboard = async (type = 'weekly', weekId = null, admin = false) => {
    const safeType = type || 'weekly';
    const params = { type: safeType };
    if (weekId) params.week_id = weekId;
    if (admin) params.admin = true;

    console.log('[API] getLeaderboard called with params:', params);
    const response = await apiClient.get('/api/leaderboard', { params });
    console.log('[API] getLeaderboard response:', response.data?.length, 'items');
    return response.data;
};

// Admin Endpoints
export const getUsers = async () => {
    const response = await apiClient.get('/api/admin/users');
    return response.data;
};

export const getWeeks = async () => {
    const response = await apiClient.get('/api/admin/weeks');
    return response.data;
};

export const deleteQuestion = async (questionId) => {
    const response = await apiClient.delete(`/api/admin/questions/${questionId}`);
    return response.data;
};

export const addQuestion = async (questionData) => {
    const response = await apiClient.post('/api/admin/questions', questionData);
    return response.data;
};

export const updateConfig = async (configData) => {
    const response = await apiClient.post('/api/admin/config', configData);
    return response.data;
};

export const getAdminQuestions = async (weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await apiClient.get('/api/admin/questions-full', { params });
    return response.data;
};

export const generateQuestions = async (weekId, prompt = null) => {
    const params = { week_id: weekId };
    if (prompt) params.prompt = prompt;
    const response = await apiClient.post('/api/admin/generate-questions', null, { params });
    return response.data;
};

export const generateTrendingTopics = async (weekId, prompt = null) => {
    const params = { week_id: weekId };
    if (prompt) params.prompt = prompt;
    const response = await apiClient.post('/api/admin/generate-topics', null, { params });
    return response.data;
};

export const generateTieredQuestions = async (weekId, selectedTopics) => {
    const response = await apiClient.post('/api/admin/generate-tiered-questions', {
        week_id: weekId,
        selected_topics: selectedTopics
    });
    return response.data;
};

export const regenerateQuestionsWithFeedback = async (weekId, sessionId, feedback) => {
    const response = await apiClient.post('/api/admin/regenerate-questions', {
        week_id: weekId,
        session_id: sessionId,
        feedback: feedback
    });
    return response.data;
};

export const addBatchQuestions = async (questions) => {
    const response = await apiClient.post('/api/admin/questions/batch', { questions });
    return response.data;
};

export const getSubmissionDetails = async (userId, weekId) => {
    const response = await apiClient.get(`/api/admin/submission/${userId}`, {
        params: { week_id: weekId }
    });
    return response.data;
};

export const getMySubmission = async (userId, weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await apiClient.get(`/api/my-submission/${userId}`, { params });
    return response.data;
};

export const deleteTesterSubmission = async (userId, weekId = null) => {
    const params = weekId ? { week_id: weekId } : {};
    const response = await apiClient.delete(`/api/admin/tester-submission/${userId}`, { params });
    return response.data;
};

export const grantWildcard = async (phone, bonusPoints, bonusWeeks, reason) => {
    const response = await apiClient.post('/api/admin/wildcard', {
        phone,
        bonus_points: bonusPoints,
        bonus_weeks: bonusWeeks,
        reason
    });
    return response.data;
};

// ============================================
// YAADEIN (MEMORIES ALBUM) ENDPOINTS
// ============================================

const YAADEIN_STORAGE_KEY = 'yaadein_local_memories';

const resolveMemoryUrl = (item) => {
    if (!item) return item;
    const url = item.image_url || '';
    const highResUrl = item.high_res_url || url;
    return {
        ...item,
        image_url: url.startsWith('/api/memories/') ? `${API_URL}${url}` : url,
        high_res_url: highResUrl.startsWith('/api/memories/') ? `${API_URL}${highResUrl}` : highResUrl,
    };
};

const getLocalMemories = () => {
    try {
        const raw = localStorage.getItem(YAADEIN_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveLocalMemories = (items) => {
    try {
        localStorage.setItem(YAADEIN_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('[Yaadein] Failed to persist local fallback memories:', e);
    }
};

export const getMemories = async ({ userPhone = '', isAdmin = false } = {}) => {
    try {
        const response = await apiClient.get('/api/memories', {
            params: {
                user_phone: userPhone || undefined,
                admin: isAdmin || undefined,
            },
        });
        const items = (response.data?.items || []).map(resolveMemoryUrl);
        return {
            items,
            seed_overrides: response.data?.seed_overrides || {},
            is_admin: !!response.data?.is_admin,
        };
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            const localItems = getLocalMemories();
            const cleanPhone = String(userPhone || '').replace(/\D/g, '').slice(-10);
            const filtered = localItems.filter((item) => {
                if (item.status === 'rejected') return false;
                if (isAdmin || item.status === 'approved') return true;
                const itemPhone = String(item.uploader_phone || '').replace(/\D/g, '').slice(-10);
                return cleanPhone && itemPhone === cleanPhone;
            });
            return { items: filtered, seed_overrides: {}, is_admin: isAdmin };
        }
        throw err;
    }
};

export const uploadMemory = async ({
    caption,
    imageDataUrl,
    thumbDataUrl,
    uploaderName,
    uploaderPhone,
    width,
    height,
    sizeBytes,
    isAdmin = false,
}) => {
    try {
        const response = await apiClient.post('/api/memories', {
            caption,
            image_data_url: imageDataUrl,
            thumb_data_url: thumbDataUrl,
            uploader_name: uploaderName,
            uploader_phone: uploaderPhone,
            width,
            height,
            size_bytes: sizeBytes,
        });
        return {
            ...response.data,
            memory: resolveMemoryUrl(response.data?.memory),
        };
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            const newMemory = {
                id: `local-${Date.now()}`,
                caption: (caption || '').trim(),
                image_url: thumbDataUrl || imageDataUrl,
                high_res_url: imageDataUrl,
                uploader_name: (uploaderName || 'Club Member').trim(),
                uploader_phone: uploaderPhone || '',
                status: isAdmin ? 'approved' : 'pending',
                likes: 0,
                width,
                height,
                size_bytes: sizeBytes,
                created_at: new Date().toISOString(),
            };
            const existing = getLocalMemories();
            saveLocalMemories([newMemory, ...existing]);
            return {
                status: 'success',
                message: isAdmin ? 'Memory published!' : 'Memory submitted for admin approval!',
                memory: newMemory,
            };
        }
        throw err;
    }
};

export const moderateMemory = async (memoryId, { status, caption }, adminPhone = '') => {
    try {
        const response = await apiClient.patch(
            `/api/memories/${memoryId}`,
            { status, caption },
            { params: { admin_phone: adminPhone || undefined } }
        );
        return {
            ...response.data,
            memory: resolveMemoryUrl(response.data?.memory),
        };
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            const existing = getLocalMemories();
            const updated = existing.map((m) =>
                m.id === memoryId
                    ? {
                          ...m,
                          ...(status ? { status } : {}),
                          ...(caption !== undefined && caption !== null ? { caption } : {}),
                      }
                    : m
            );
            saveLocalMemories(updated);
            return {
                status: 'success',
                memory: updated.find((m) => m.id === memoryId),
            };
        }
        throw err;
    }
};

export const deleteMemory = async (memoryId, userPhone = '') => {
    try {
        const response = await apiClient.delete(`/api/memories/${memoryId}`, {
            params: { user_phone: userPhone || undefined },
        });
        return response.data;
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            const existing = getLocalMemories().filter((m) => m.id !== memoryId);
            saveLocalMemories(existing);
            return { status: 'success', deleted_id: memoryId };
        }
        throw err;
    }
};

export const likeMemory = async (memoryId, { unlike = false } = {}) => {
    try {
        const response = await apiClient.post(`/api/memories/${memoryId}/like`, null, {
            params: { unlike: unlike || undefined },
        });
        return response.data;
    } catch (err) {
        if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
            const delta = unlike ? -1 : 1;
            const existing = getLocalMemories();
            const updated = existing.map((m) =>
                m.id === memoryId ? { ...m, likes: Math.max(0, (m.likes || 0) + delta) } : m
            );
            saveLocalMemories(updated);
            return { status: 'success', id: memoryId };
        }
        throw err;
    }
};
