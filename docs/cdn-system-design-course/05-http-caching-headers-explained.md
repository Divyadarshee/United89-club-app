# Chapter 05: HTTP Caching Headers Explained

> *"A computer will do what you told it to do, not what you wanted it to do. If you misconfigure your headers, your CDN is just an expensive pass-through router."*

---

## 1. The Shipping Label Analogy

When a medical laboratory ships a vial of medicine across the country, they don't just put it in a brown cardboard box. They slap a bright, bold **Handling Label** on the outside:

```
┌──────────────────────────────────────────────────────────┐
│                   SHIPPING INSTRUCTIONS                  │
│                                                          │
│  [X] PUBLIC CARRIER OK   : Any warehouse may store this  │
│  [X] SHELF LIFE (SHOP)   : 365 Days                      │
│  [X] SHELF LIFE (HUB)    : 365 Days                      │
│  [X] DO NOT INSPECT      : Contents are sealed & final   │
└──────────────────────────────────────────────────────────┘
```

When delivery drivers, regional distribution centers, and local pharmacy clerks see this label, they know exactly how to treat the package without opening it.

In HTTP networking, **HTTP Response Headers** are the shipping labels. The most powerful shipping label on the entire Internet is the `Cache-Control` header.

---

## 2. The Production Header in Our Repository

Let us look at the exact line of code we wrote in [`quiz-app/backend/routers/memories.py`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/routers/memories.py) (lines 135 and 190):

```python
headers = {
    "ETag": etag,
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
}
```

And in [`quiz-app/firebase.json`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/firebase.json) (lines 11–20):

```json
"headers": [
  {
    "source": "/yaadein/**",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, s-maxage=31536000, immutable"
      }
    ]
  }
]
```

This single string contains **four distinct directives**, each addressing a specific layer of the global Internet. Let us decode them one by one.

---

## 3. The Directives Decoded

```
      Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable
                       │             │                 │              │
        1. Target ─────┘             │                 │              │
        2. Client Browser TTL ───────┘                 │              │
        3. Shared CDN Proxy TTL ───────────────────────┘              │
        4. Revalidation Prohibition ──────────────────────────────────┘
```

---

### Directive 1: `public` vs. `private`

Who is allowed to store a copy of this response?

- **`public`:** Any intermediary computer between the origin server and the user—including corporate proxies, ISP caches, and global CDN Edge PoPs—is legally allowed to cache this file and serve it to other people.
  - *Where to use:* Batch reunion photos, CSS files, JavaScript bundles, product catalog images, public blog posts.
- **`private`:** **ONLY the individual end-user's browser** is allowed to cache this file. Shared CDN edge nodes and intermediate proxies are strictly forbidden from storing it.
  - *Where to use:* A user's bank statement, medical records, private direct messages, or an account settings page containing personal phone numbers.
  - *What happens if you accidentally set `public` on a private invoice?* User B in Bhubaneswar might download User A's private tax invoice directly from the shared CDN edge!

---

### Directive 2: `max-age=31536000` (Client Browser TTL)

- `max-age` specifies the maximum time (in seconds) that the **client's browser** considers the file "fresh".
- $31,536,000\text{ seconds} = 60\text{s} \times 60\text{m} \times 24\text{h} \times 365\text{d} = \mathbf{1\text{ year (365 days)}}$.
- When an alumnus loads a photo on Monday, his phone saves it into local flash storage. When he reopens the app on Wednesday, the browser checks its internal clock:
  - *Has 1 year passed since Monday? No.*
  - The browser reads the photo directly from the phone's local disk cache in **0 milliseconds without sending a single byte over WiFi or 4G**.

---

### Directive 3: `s-maxage=31536000` (Shared CDN Proxy TTL)

The `s-` stands for **Shared**.
- If both `max-age` and `s-maxage` are present, **public shared proxies (CDNs) will obey `s-maxage` and completely ignore `max-age`**.
- The client browser ignores `s-maxage` and obeys `max-age`.

#### Why have two different timers?
Imagine a news website where the homepage HTML updates every 60 seconds:
```http
Cache-Control: public, max-age=10, s-maxage=60
```
- The user's browser only caches the homepage for **10 seconds** (so if the user refreshes, they see breaking news quickly).
- But the shared CDN Edge caches it for **60 seconds** (shielding the origin server from 50,000 requests per second during an election night!).

In our Yaadein photo album, because images are permanent memories that never change once uploaded, we set both the browser and the CDN proxy to 1 year: `max-age=31536000, s-maxage=31536000`.

---

### Directive 4: `immutable` (The Holy Grail of Web Performance)

Introduced in 2017 by Facebook and Mozilla, `immutable` is one of the most brilliant performance optimizations in the HTTP specification.

To appreciate it, you must understand what happens when a user presses the **Refresh Button (F5 or Cmd+R)** in their browser.

```
Standard Browser Behavior on Refresh (WITHOUT immutable):
1. User clicks Refresh.
2. Even if max-age=31536000 is still fresh, the browser assumes:
   "The user clicked Refresh because they think the page might be broken or changed!"
3. The browser sends 50 conditional HTTP requests to the server:
   "GET /photo1.jpg - If-None-Match: 'abc'"
   "GET /photo2.jpg - If-None-Match: 'xyz'"
4. Even though the server replies "304 Not Modified", the phone had to establish
   connections and wait for 50 round trips!
```

#### What `immutable` Tells the Browser:
> *"Listen to me: This file will NEVER change in its lifetime. If the user presses Reload, do NOT bother sending a 304 validation request over the network. Just pull the image straight from disk!"*

By adding `immutable` to our Yaadein photos, refreshing the gallery loads all 50 photos instantaneously from mobile disk memory—with **zero network activity**.

---

## 4. The Most Confused Directives: `no-cache` vs. `no-store`

In almost every tech company, you will find senior engineers who confuse `no-cache` with `no-store`. Let us clarify them once and for all:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             no-cache vs. no-store                           │
├───────────────────────────────────┬─────────────────────────────────────────┤
│            no-cache               │                no-store                 │
│  "You CAN cache it, but you must  │       "DO NOT SAVE A SINGLE BYTE        │
│   CHECK WITH ME before using it." │         TO DISK OR CACHE ANYWHERE!"     │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### 1. `Cache-Control: no-cache`
- Despite its name, `no-cache` **DOES allow caching!**
- The browser or CDN saves the file to disk.
- However, before rendering the file, the browser **MUST send a validation ping (`ETag`) to the server** to ask: *"Is this still the latest version?"*
- If the server says yes (304), it uses the cached copy.

### 2. `Cache-Control: no-store`
- The file must **NEVER be written to disk storage or persistent memory**.
- As soon as the browser renders the page, the bytes must be discarded from temporary RAM.
- *Where to use:* Credit card numbers, OTP authentication codes, password reset screens, classified documents.

---

## 5. Summary Cheat Sheet: Choosing the Right Header

| Content Type | Recommended `Cache-Control` Header | Rationale |
| :--- | :--- | :--- |
| **Hashed / Unique Images** (Yaadein photos) | `public, max-age=31536000, s-maxage=31536000, immutable` | URL never changes; cache everywhere for maximum speed. |
| **App Entry HTML** (`index.html`) | `no-cache` | Must always verify if a new frontend deploy happened before rendering. |
| **Dynamic API Endpoints** (`GET /api/memories`) | `no-store, private` | Contains live like counts and new uploads; must always fetch fresh from backend. |
| **User Profile / Personal Data** | `private, max-age=300` | Only end-user's device may cache; expires in 5 minutes. |

---

## 6. Hands-On Lab: Inspecting Headers in Chrome DevTools

You can inspect these exact headers in your own browser right now:

1. Open Google Chrome and navigate to the Yaadein album.
2. Press **F12** (or `Cmd + Option + I` on Mac) to open **Developer Tools**.
3. Click on the **Network** tab, and filter by **Img**.
4. Refresh the page and click on any thumbnail request (e.g. `thumb` or `yaadein-01.jpg`).
5. Inspect the **Response Headers** panel:

```http
HTTP/2 200 OK
content-type: image/webp
cache-control: public, max-age=31536000, s-maxage=31536000, immutable
etag: "thumb-7a8f190e2b..."
```

6. Refresh the page a second time. Look at the **Size** column in the network table:
   - Instead of showing `140 KB`, Chrome will display **`(memory cache)`** or **`(disk cache)`**!
   - Time: **`0 ms`**.

In the next chapter, we will examine what happens when an expired cache item needs to be checked without re-downloading megabytes of data: **ETags, Hashing, and 304 Not Modified**.

---

### [$\leftarrow$ Previous: Chapter 04](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/docs/cdn-system-design-course/04-lru-cache-and-eviction-deep-dive.md) | [Next: Chapter 06 — ETags & 304 Not Modified $\to$](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/docs/cdn-system-design-course/06-etags-hashing-and-304-not-modified.md)
