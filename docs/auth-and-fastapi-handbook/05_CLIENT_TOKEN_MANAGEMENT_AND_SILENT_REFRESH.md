# Chapter 5: Client-Side Token Lifecycle & Silent Refresh

> *"The hallmark of great software engineering is making complex security mechanics completely invisible to the human user."*

---

## 5.1 The Client-Side Authentication State Machine

In a React Single-Page Application (SPA), the client application runs entirely inside the user's browser runtime. Unlike traditional multi-page apps where the server re-renders every page from scratch, a React SPA maintains its own internal state machine across route transitions.

In our frontend ([`quiz-app/frontend/src/context/AuthContext.jsx`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/context/AuthContext.jsx)), the authentication state is governed by a React Context provider:

```javascript
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Determines authentication state dynamically
    const isAuthenticated = !!user || !!localStorage.getItem('access_token');
    
    // ...
};
```

When a user logs in, the client receives our dual JWT tokens and stores them in browser storage:
1. `access_token` (Short-lived: 15 minutes).
2. `refresh_token` (Long-lived: 15 days).
3. `user_id` (Normalized alumni phone number).
4. `admin_auth` (`"true"` if role is admin).

---

## 5.2 Layer 1: Automatic Bearer Token Injection (Axios Request Interceptor)

Every protected backend route in FastAPI expects the client to present their access token in the standard HTTP header:

```http
GET /api/quiz/current HTTP/1.1
Host: api.united89.club
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Instead of manually typing `headers: { Authorization: ... }` on every single `fetch()` or `axios.get()` call across 50 different components, we configure an **Axios Request Interceptor** in [`quiz-app/frontend/src/services/api.js`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/services/api.js):

```javascript
import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
    headers: { 'Content-Type': 'application/json' }
});

// Automatic Bearer Token Injection
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
```

Before **any** outgoing HTTP request leaves the browser, this interceptor runs, inspects `localStorage`, and injects the `Authorization: Bearer <token>` header automatically.

---

## 5.3 Layer 2: The Silent Refresh Dilemma & The Stampede Problem

Every 15 minutes, the access token expires. When it expires, FastAPI rejects any incoming request with:
$$\mathbf{\text{HTTP 401 Unauthorized}} \quad \text{("Token has expired")}$$

If we do not handle this, the user will be rudely interrupted with an error popup or booted to the login page every 15 minutes!

### The "Refresh Stampede" Race Condition
Imagine an alumnus opens the Welcome page after being away for 20 minutes. The React application mounts and immediately fires **four API calls in parallel**:
1. `GET /api/user/profile`
2. `GET /api/quiz/current`
3. `GET /api/quiz/config`
4. `GET /api/leaderboard/current`

Because the 15-minute access token has expired, **all four requests return HTTP 401 at the exact same millisecond!**

```mermaid
sequenceDiagram
    autonumber
    participant UI as React Components (A, B, C, D)
    participant Interceptor as Axios Response Interceptor
    participant Server as FastAPI /api/auth/refresh

    Note over UI,Server: Flawed Naive Architecture (Stampede)
    UI->>Interceptor: Request A, B, C, D fail with 401
    Interceptor->>Server: Refresh Call A
    Interceptor->>Server: Refresh Call B
    Interceptor->>Server: Refresh Call C
    Interceptor->>Server: Refresh Call D
    Note over Interceptor,Server: 4 simultaneous refresh requests! Waste of bandwidth & race condition!
```

If the interceptor naively called `/api/auth/refresh` on every 401 error:
- It would fire 4 duplicate refresh requests to the backend.
- The server would issue 4 different access tokens.
- Network race conditions could cause earlier tokens to overwrite newer ones in `localStorage`.

---

## 5.4 The Solution: The Concurrent Promise Queue Pattern

In [`quiz-app/frontend/src/services/api.js`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/services/api.js), we implement an enterprise-grade **Concurrent Promise Queue**:

```mermaid
sequenceDiagram
    autonumber
    participant App as React Components
    participant Queue as Interceptor Promise Queue
    participant Server as Backend /api/auth/refresh

    Note over App,Server: Resilient Queue Architecture
    App->>Queue: Request #1 fails with 401 (Expired Token)
    Queue->>Server: isRefreshing = true -> Calls /api/auth/refresh
    App->>Queue: Request #2, #3, #4 fail with 401
    Note over Queue: Queues #2, #3, #4 into failedQueue array
    Server-->>Queue: Returns New Access Token
    Queue->>Queue: processQueue: Resolves promises with new token
    Queue->>Server: Replays Request #1, #2, #3, #4 with new token
    Server-->>App: All 4 requests succeed seamlessly!
```

### Complete Annotated Source Code (`api.js`)
```javascript
let isRefreshing = false;
let failedQueue = [];

// Helper: Dispatches new token (or error) to all waiting queued requests
const processQueue = (error, token = null) => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(token);
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Check if error is 401 and request hasn't already been retried
        if (error.response?.status === 401 && !originalRequest._retry) {
            const refreshToken = localStorage.getItem('refresh_token');

            // If no refresh token exists, we cannot refresh
            if (!refreshToken) {
                return Promise.reject(error);
            }

            // Case A: Refresh already in flight -> Queue this request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((newToken) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return apiClient(originalRequest); // Replay original request
                    })
                    .catch((err) => Promise.reject(err));
            }

            // Case B: First request to fail -> Acquire lock & initiate refresh
            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call backend refresh endpoint
                const res = await axios.post(`${API_URL}/api/auth/refresh`, {
                    refresh_token: refreshToken
                });

                const { access_token, refresh_token: newRefreshToken } = res.data;
                
                // Persist new access token (and optional rotated refresh token)
                localStorage.setItem('access_token', access_token);
                if (newRefreshToken) {
                    localStorage.setItem('refresh_token', newRefreshToken);
                }

                // Update default headers and retry original request
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                originalRequest.headers.Authorization = `Bearer ${access_token}`;

                // Flush queue and resume all pending callers
                processQueue(null, access_token);
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Refresh token is expired (15 days passed) or revoked
                processQueue(refreshError, null);
                
                // Nuclear cleanup & event broadcast
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.dispatchEvent(new Event('auth:logout'));
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false; // Release lock
            }
        }

        return Promise.reject(error);
    }
);
```

---

## 5.5 Graceful Expiration & Custom Event Decoupling

What happens when the 15-day refresh token **also** expires?

When the refresh token expires, the backend endpoint `/api/auth/refresh` responds with `HTTP 401: Token has expired`. At this point, the user's session has genuinely ended, and they must re-authenticate.

### The Decoupling Challenge
Notice where this failure happens: deep inside `api.js` (a standalone vanilla JavaScript utility file).  
How does a plain JavaScript file tell React's `AuthContext` component tree to clear its state and transition the UI to the login screen without creating circular imports?

### The Solution: Custom DOM Event Broadcasting
1. When refresh fails, `api.js` fires a custom browser event:
   ```javascript
   window.dispatchEvent(new Event('auth:logout'));
   ```
2. In [`quiz-app/frontend/src/context/AuthContext.jsx`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/context/AuthContext.jsx), a listener handles this cleanly:
   ```javascript
   useEffect(() => {
       const handleLogoutEvent = () => logout();
       window.addEventListener('auth:logout', handleLogoutEvent);

       return () => {
           window.removeEventListener('auth:logout', handleLogoutEvent);
       };
   }, [logout]);
   ```
3. `logout()` clears all stored user identifiers and sets `user = null`.
4. React immediately unmounts protected views and renders the Welcome / Login screen.

---

## 5.6 Summary of Key Concepts

1. **Axios Request Interceptors** eliminate boilerplate by automatically injecting `Authorization: Bearer <token>` into all outgoing network requests.
2. The **Concurrent Promise Queue** prevents the "Refresh Stampede" by locking refresh execution with `isRefreshing` and queuing parallel requests into a pending Promise array.
3. Once the new access token arrives, `processQueue()` replays all paused requests simultaneously.
4. **Custom DOM Events (`auth:logout`)** decouple vanilla networking scripts from the React component tree, enabling clean, error-free session termination.

---

## 🧠 Chapter 5 Review Questions

Try answering these questions yourself before consulting the [Appendix](07_APPENDIX_REVIEW_QUESTIONS_AND_ANSWERS.md)!

1. **Concurrency Analysis**: Suppose three HTTP requests fail simultaneously with HTTP 401. Walk through the execution order of `apiClient.interceptors.response` to explain what happens to Request #1, Request #2, and Request #3.
2. **State Management**: Why is a Promise queue (`failedQueue.push({ resolve, reject })`) necessary? What would happen if we simply discarded the failed requests and told the user to refresh the page?
3. **Infinite Loop Prevention**: Notice the flag `originalRequest._retry = true;`. What catastrophic bug would occur if this flag were missing and the backend continued returning 401 for a replayed request?
4. **Architectural Decoupling**: Why is using `window.dispatchEvent(new Event('auth:logout'))` cleaner than importing the React `AuthContext` or router inside `services/api.js`?
