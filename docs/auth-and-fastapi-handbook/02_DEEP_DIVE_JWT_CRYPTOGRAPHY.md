# Chapter 2: Deep Dive: JSON Web Tokens (JWT) & Cryptographic Signing

> *"Do not trust what a client claims; verify the mathematical seal upon their claim."*

---

## 2.1 The Anatomy of a JSON Web Token (JWT)

A **JSON Web Token (JWT)** (defined by [RFC 7519](https://tools.ietf.org/html/rfc7519)) is an open, industry-standard method for representing claims securely between two parties.

When you look at a raw JWT in transit, it looks like a long string of random characters with two dots:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NDM3NTU1OTAwIiwicm9sZSI6ImFkbWluIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc5MzY3NzY5OSwiaWF0IjoxNzkzNjc2Nzk5fQ.c44q3m8J9lQ0w2k_example_sig_Z0
```

Notice the two periods (`.`). A JWT is strictly composed of **three parts**:

$$\text{JWT} = \underbrace{\text{Header}}_{\text{Part 1}} \;.\; \underbrace{\text{Payload}}_{\text{Part 2}} \;.\; \underbrace{\text{Signature}}_{\text{Part 3}}$$

```mermaid
graph TD
    A["Raw JWT String"] --> B["Part 1: Header (Algorithm & Token Type)"]
    A --> C["Part 2: Payload (Claims, User ID, Role, Expiry)"]
    A --> D["Part 3: Cryptographic Signature (HMAC-SHA256)"]
    
    style B fill:#1e3a5f,stroke:#3b82f6,stroke-width:2px
    style C fill:#4a154b,stroke:#a855f7,stroke-width:2px
    style D fill:#1b4332,stroke:#10b981,stroke-width:2px
```

---

## 2.2 Base64Url Encoding: Not Encryption!

> [!WARNING]
> **Base64Url is NOT Encryption!**  
> Anyone who possesses a JWT can instantly decode the Header and Payload into plain, human-readable JSON using any online decoder or terminal command. Never put passwords, credit cards, or raw database secrets in a JWT payload!

### What is Base64Url?
Standard Base64 encoding converts raw binary bytes into 64 printable ASCII characters (`A-Z`, `a-z`, `0-9`, `+`, `/`). However, the characters `+`, `/`, and padding `=` have special syntactic meaning inside URLs and HTTP headers. 

**Base64Url** modifies standard Base64 for URL safety:
- Replaces `+` with `-` (minus).
- Replaces `/` with `_` (underscore).
- Strips trailing padding characters (`=`).

Let's decode the three parts of our token manually:

### Part 1: The Header
Decodes from `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```
* **`alg`**: The cryptographic signing algorithm (`HS256` = HMAC using SHA-256).
* **`typ`**: The type of token (always `"JWT"`).

### Part 2: The Payload (The Claims)
Decodes from `eyJzdWIiOiI5NDM3NTU1OTAwIiwicm9sZSI6ImFkbWluIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc5MzY3NzY5OSwiaWF0IjoxNzkzNjc2Nzk5fQ`:
```json
{
  "sub": "9437555900",
  "role": "admin",
  "type": "access",
  "exp": 1793677699,
  "iat": 1793676799
}
```
In JWT terminology, pieces of data inside the payload are called **claims**:
* **`sub` (Subject)**: The unique identifier of the user (in our app: the normalized phone number `9437555900`).
* **`role`**: Our custom claim used for **Role-Based Access Control (RBAC)** (`"admin"` vs `"member"`).
* **`type`**: Our custom token classification claim (`"access"` vs `"refresh"`).
* **`iat` (Issued At)**: Unix timestamp when the token was created.
* **`exp` (Expiration Time)**: Unix timestamp when the token ceases to be valid.

---

## 2.3 Part 3: The Cryptographic Signature & Mathematical Proof

This is where the magic happens. How does the server know that the client didn't secretly edit `"role": "member"` to `"role": "admin"`?

The server computes the signature using this exact mathematical formula:

$$\text{Signature} = \text{HMAC-SHA256}\Big(\text{Base64Url}(\text{Header}) + \text{"."} + \text{Base64Url}(\text{Payload}), \;\; \mathcal{K}_{\text{secret}}\Big)$$

Where:
* **$\mathcal{K}_{\text{secret}}$**: A high-entropy secret string (e.g., `united89-super-secret-club-key-xyz789`) stored securely in server environment variables, **never sent to the client**.
* **HMAC-SHA256**: A cryptographic Hash-based Message Authentication Code.

### Walkthrough: What happens if an attacker tampers with the token?
Imagine Bob logs in as a regular member:
1. His legitimate token payload is: `{"sub": "9876543210", "role": "member"}`.
2. Bob is clever. He decodes the Base64Url string in his browser, changes `"role": "member"` to `"role": "admin"`, and re-encodes it.
3. Bob sends this modified token to FastAPI: `GET /api/admin/config`.
4. FastAPI's `decode_token()` function runs:
   - It takes the header and Bob's modified payload.
   - It takes the server's private `SECRET_KEY` from memory.
   - It computes what the HMAC-SHA256 signature **should be** for that payload.
   - It compares its computed signature against the signature string Bob attached to the token.
5. **They do not match!** Because Bob does not possess `SECRET_KEY`, he cannot compute the valid cryptographic signature for the modified payload.
6. The library immediately raises `jwt.InvalidTokenError`, and FastAPI terminates the request with **`HTTP 401: Invalid token signature`**.

---

## 2.4 Symmetric vs. Asymmetric Signing

There are two major families of digital signatures used in web authentication:

| Feature | Symmetric (e.g., `HS256`) | Asymmetric (e.g., `RS256`, `ES256`) |
| :--- | :--- | :--- |
| **Key Mechanism** | **One single shared secret** ($\mathcal{K}_{\text{secret}}$) | **Keypair**: Private Key + Public Key |
| **Signing** | Done with $\mathcal{K}_{\text{secret}}$ | Done only with the **Private Key** |
| **Verification** | Done with the same $\mathcal{K}_{\text{secret}}$ | Done with the open **Public Key** |
| **Use Case in this Project** | Internal FastAPI token issuance (`quiz-app/backend/auth/jwt.py`). Fast, lightweight, zero external requests. | External Google/Firebase ID tokens (`firebase_admin.auth.verify_id_token`). Google signs with their private key, backend verifies with Google's public certificates. |

---

## 2.5 The Dual-Token Strategy (Access Token + Refresh Token)

Why don't we just issue a single JWT that lasts for 1 year so the user never has to log in again?

### The Security Vulnerability of Long-Lived Access Tokens
Remember: **A JWT is stateless.** The server does not query a database on each request.  
If an access token is valid for 1 year and an attacker steals it via an insecure browser extension or packet capture, **the attacker has access for 1 full year.** You cannot easily revoke a stateless token without introducing a database blacklist (which destroys the performance benefit of statelessness).

### The Solution: Short-Lived Access + Long-Lived Refresh
We implement a dual-token rotation architecture:

```mermaid
sequenceDiagram
    autonumber
    participant Client as React Client (localStorage)
    participant API as FastAPI Backend
    
    Note over Client,API: 1. Login Phase
    Client->>API: Validates OTP / Firebase ID Token
    API-->>Client: Returns Access Token (15 min) + Refresh Token (15 days)
    
    Note over Client,API: 2. Normal Operations (0 - 15 min)
    Client->>API: GET /api/profile (Bearer Access Token)
    API-->>Client: 200 OK (Validated locally via HS256)
    
    Note over Client,API: 3. Token Expiration Phase (After 15 min)
    Client->>API: GET /api/quiz/current (Expired Access Token)
    API-->>Client: 401 Unauthorized ("Token has expired")
    
    Note over Client,API: 4. Silent Refresh Phase
    Client->>API: POST /api/auth/refresh { refresh_token }
    API->>API: Validates Refresh Token signature & type == "refresh"
    API-->>Client: 200 OK { new access_token (15 min) }
    Client->>API: Retries original request with new Access Token
    API-->>Client: 200 OK
```

1. **Access Token (Short-Lived: 15 Minutes)**:
   - Used for every single HTTP request in the `Authorization: Bearer <token>` header.
   - If stolen, the attacker's window of opportunity is limited to a maximum of 15 minutes.
2. **Refresh Token (Long-Lived: 15 Days)**:
   - Stored safely and used **only once every 15 minutes** to request a new access token from `/api/auth/refresh`.
   - Never sent to general API endpoints (`/api/quiz`, `/api/profile`, etc.).

---

## 2.6 Token Type Enforcement & RBAC Implementation

Look at the production implementation from [`quiz-app/backend/auth/jwt.py`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/auth/jwt.py):

```python
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

def create_access_token(user_id: str, role: str = "member") -> str:
    """Creates a short-lived access token (15 minutes) with RBAC role"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",      # Strict type demarcation
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """Creates a long-lived refresh token (15 days)"""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",     # Strict type demarcation
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str, expected_type: str = "access") -> dict:
    """Decodes and validates token signature, expiration, and token type"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # DEFENSE: Token Substitution Attack Prevention
        token_type = payload.get("type")
        if token_type != expected_type:
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid token type: expected '{expected_type}', got '{token_type}'"
            )
            
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
```

### Why is `expected_type` strictly verified?
Suppose a careless developer forgets to check `payload.get("type")`.  
A malicious user could take their 15-day **Refresh Token** and pass it as a Bearer token to `GET /api/quiz/current`. If the backend only checked the signature and expiration, the request would succeed! The attacker would effectively have a 15-day unexpiring access token!  
By enforcing `if token_type != expected_type: raise HTTPException(401)`, we guarantee that refresh tokens can **never** be substituted for access tokens.

### Role-Based Access Control (RBAC) Assignment
In `quiz-app/backend/routers/auth.py`, when a user logs in (via Firebase or OTP), the backend checks if their normalized phone matches the designated administrator:

```python
norm_phone = normalize_phone(phone)
role = "admin" if norm_phone == "9437555900" else "member"

# Issue access token with embedded role
access_token = create_access_token(user_id=phone, role=role)
```

When an endpoint needs admin privileges (e.g. `quiz-app/backend/routers/admin.py`), it simply verifies:
```python
payload = decode_token(token, expected_type="access")
if payload.get("role") != "admin":
    raise HTTPException(status_code=403, detail="Admin privileges required")
```

---

## 2.7 Summary of Key Concepts

1. A JWT consists of **Header**, **Payload**, and **Signature**, separated by periods.
2. The payload is **Base64Url-encoded**, meaning anyone can read it; it is **tamper-evident**, not encrypted.
3. The **Signature** guarantees authenticity using HMAC-SHA256 and the server's private secret key.
4. **Access Tokens (15 min)** minimize the window of compromise.
5. **Refresh Tokens (15 days)** allow seamless user sessions without re-entering OTPs every 15 minutes.
6. **Token Type Demarcation** (`type: access` vs `type: refresh`) protects against token substitution attacks.

---

## 🧠 Chapter 2 Review Questions

Try answering these questions yourself before consulting the [Appendix](07_APPENDIX_REVIEW_QUESTIONS_AND_ANSWERS.md)!

1. **Decoding Challenge**: Explain step-by-step why an attacker who intercepts a JWT cannot change `"role": "member"` to `"role": "admin"` without causing the server to reject the token.
2. **Cryptographic Foundations**: What is the key operational difference between symmetric signing (`HS256`) and asymmetric signing (`RS256`)? In our project, where is `HS256` used, and where is `RS256` used?
3. **Vulnerability Analysis**: Suppose an application issues both access tokens and refresh tokens, but the backend's token validation function does not check the `"type"` claim. Describe an attack scenario that exploits this omission.
4. **Clock Skew & Expiration**: How does the server determine if a token has expired? What happens if the server's clock is 5 minutes behind the client's clock?
