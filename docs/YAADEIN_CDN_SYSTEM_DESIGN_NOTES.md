# System Design Revision Notes: Photo Album ("Yaadein"), CDNs, Edge Caching & Firestore

> **Context:** Built for the **United89 / UCE ’87 Club App (`Yaadein • यादें`)**
> **Key Files in Repo:**
> - Frontend Gallery & Upload Modal: [`quiz-app/frontend/src/pages/Yaadein.jsx`](../quiz-app/frontend/src/pages/Yaadein.jsx)
> - Client-Side Image Compressor: [`quiz-app/frontend/src/utils/imageCompressor.js`](../quiz-app/frontend/src/utils/imageCompressor.js)
> - Curated Seed Metadata: [`quiz-app/frontend/src/data/yaadeinSeedData.js`](../quiz-app/frontend/src/data/yaadeinSeedData.js)
> - Backend API & Binary Image Endpoint: [`quiz-app/backend/routers/memories.py`](../quiz-app/backend/routers/memories.py)
> - Firebase Hosting CDN Rules: [`quiz-app/firebase.json`](../quiz-app/firebase.json)

---

## 1. Core Question: Does a CDN Store *Everything*, or Is It an LRU Cache?

**Short Answer:** **A CDN is NOT permanent storage — it is a globally distributed, multi-tiered Read-Through Cache that uses TTL (Time-To-Live) + LRU/LFU eviction!**

To understand why, always separate your architecture into two layers:

| Layer | Role | Stores Everything? | Storage Medium | Eviction Policy |
| :--- | :--- | :--- | :--- | :--- |
| **1. Origin Storage** *(Source of Truth)* | Cloud Storage / S3 / Firestore / Container Static Disk | **YES (100% of files permanently)** | High-durability replicated disks/SSD in 1 region (e.g., `asia-south2` Delhi/Mumbai) | **Never evicted** (until explicitly deleted) |
| **2. CDN Edge PoPs** *(Points of Presence)* | 200+ global edge servers located close to users (Bhubaneswar, Bangalore, Singapore, New Jersey, etc.) | **NO (Only hot/requested files)** | Fast NVMe RAM/SSD cache at each local Edge PoP | **TTL Expiry + LRU / LFU** (Least Recently / Frequently Used) |

### Why Can't Edge Servers Store Everything?
Imagine YouTube, Instagram, or Google Cloud CDN:
- The **Origin** across all customers holds **exabytes** of data.
- A local **Edge PoP** (say, in Bhubaneswar or Singapore) only has a finite pool of ultra-fast RAM and NVMe SSDs.
- Therefore, an Edge PoP **pulls** an image from the Origin **only when a user near that city requests it** (this is called a **Pull CDN** / Read-Through Cache).

---

## 2. Step-by-Step: How a CDN Request Works (Cache Miss vs. Cache Hit)

```
User 1 (Bhubaneswar) ──1. GET /yaadein/yaadein-01.jpg──► [CDN Edge PoP: Kolkata/BBI]
                                                               │
                                                        (CACHE MISS!)
                                                               │
                                                  2. Fetches from Origin
                                                               ▼
                                                 [Origin Server: asia-south2]
                                                               │
                                        3. Returns image + Header:
                                           Cache-Control: public, max-age=31536000, immutable
                                           ETag: "a9f4c2..."
                                                               │
User 1 ◄──4. Returns image (~180ms) & saves in Edge LRU────────┘

--------------------------------------------------------------------------------

User 2 (Bhubaneswar, 5 mins later)
       ──1. GET /yaadein/yaadein-01.jpg──► [CDN Edge PoP: Kolkata/BBI]
                                                  │
                                            (CACHE HIT!)
                                            Origin is NEVER called!
                                                  │
User 2 ◄──2. Instant delivery (~12ms)─────────────┘
```

### What Triggers Eviction From a CDN Edge Server?
Even if you set `Cache-Control: max-age=31536000` (1 year), **`max-age` is an upper bound, NOT a guarantee of permanent residency**:
1. **TTL Expiration (`max-age` / `s-maxage`):** Once the timer expires, the edge marks the object as *stale*. Next time a user asks for it, the Edge sends a lightweight conditional request (`If-None-Match: "<ETag>"`) to the Origin. If unchanged, Origin replies `304 Not Modified` (0 bytes of image transferred!) and resets the timer.
2. **LRU / LFU Eviction (Memory Pressure):** If an image hasn't been viewed by anyone in Singapore for 2 weeks and the Singapore Edge server's SSD fills up with newer hot traffic, the **LRU (Least Recently Used)** algorithm evicts that cold image from Singapore's edge cache.
   - *Is the image lost?* **No!** It still lives safely at the Origin. If a Singapore alumni opens the app a month later, it simply does one **Cache Miss**, pulls it from Origin in ~200ms, and caches it at the Singapore edge again!

---

## 3. Why We Separate Metadata (Firestore DB) from Media Blobs (CDN)

A classic System Design anti-pattern is returning raw base64 images inside a single JSON list API (`GET /api/memories`).

### The Math (Back-of-the-Envelope Estimation)
Suppose our `Yaadein` album grows to **100 photos**, each **200 KB**:
- **Anti-Pattern (Inline Base64 in JSON list):**
  - Calling `GET /api/memories` returns a **26.6 MB JSON payload** (Base64 adds **33% overhead**!).
  - Every time a user opens the page—even to check if 1 new photo was added—they download 26.6 MB from Firestore/Backend.
  - Firestore charges per document read, and backend RAM spikes serializing 26 MB of JSON.
- **Proper System Design Pattern (Metadata DB + CDN URLs):**
  1. `GET /api/memories` returns **only metadata** (`id`, `caption`, `uploader_name`, `likes`, `status`, and `image_url`).
     - 100 items × 250 bytes = **25 KB JSON** (loads in ~30ms!).
  2. The browser renders `<img src="/yaadein/yaadein-01.jpg" loading="lazy">` or `<img src="/api/memories/{id}/image" loading="lazy">`.
  3. **Lazy Loading (`loading="lazy"`):** The browser only fetches the 4–6 images currently visible in the viewport.
  4. **Edge & Browser Caching:** Each image URL returns:
     ```http
     Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable
     ETag: "7f83b165..."
     ```
     - `public`: Allows both shared CDN Edge proxies and the user's browser to cache the image.
     - `max-age=31536000`: Browser caches locally for 1 year (365 days).
     - `s-maxage=31536000`: Shared CDN Edge PoP caches for 1 year.
     - `immutable`: Tells the browser *"This URL's content will never change; don't even send a 304 revalidation request when the user reloads the page!"*

---

## 4. Write-Path Optimization: Client-Side Compression Pipeline

When a batchmate uploads a photo from an iPhone or Android phone:
- Raw camera output is typically **4032 × 3024 px** (**5 MB to 12 MB**).
- Uploading 10 MB over mobile 4G takes 5–15 seconds and often fails on flaky connections.
- Furthermore, Firestore has a strict **1 MiB (1,048,576 bytes) maximum document size limit**.

### Our Solution (`src/utils/imageCompressor.js`)
Before uploading a single byte over the network:
1. We decode the image in the browser using `FileReader` + `Image`.
2. We draw it onto an HTML5 `<canvas>` scaled proportionally so the longest edge is `≤ 1400px`.
3. We compress it using `canvas.toDataURL('image/webp', 0.82)` (with automatic fallback to `image/jpeg`).
4. **Result:** A **5.4 MB** phone photo becomes a crisp **~140 KB** image in **< 80 milliseconds** right on the user's phone CPU/GPU!

---

## 5. Moderation State Machine (Admin Approval Workflow)

To keep the club album high-quality without blocking contributors:

```
                  ┌──────────────────────────────────────┐
                  │   Member Uploads Photo (Phone/Web)   │
                  └──────────────────┬───────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
             (Regular Member)                   (Admin User)
                    │                                 │
                    ▼                                 ▼
         ┌─────────────────────┐           ┌─────────────────────┐
         │  status: "pending"  │           │ status: "approved"  │
         │ (Visible ONLY to    │           │ (Live to Everyone)  │
         │  Uploader & Admin)  │           └─────────────────────┘
         └──────────┬──────────┘
                    │
        ┌───────────┴───────────┐
        │ Admin Clicks Action   │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  ✅ Approve   │       │  🗑️ Delete    │
│ ("approved")  │       │  (Removed)    │
└───────────────┘       └───────────────┘
```

---

## 6. Quick Revision Cheat Sheet (For Interviews & Future Reference)

1. **Pull CDN vs. Push CDN:**
   - **Pull CDN (Most common — Cloudflare, Fastly, Firebase Hosting CDN, CloudFront):** Origin holds everything; Edge pulls on first Cache Miss and caches via LRU + TTL.
   - **Push CDN:** You proactively upload assets directly to edge nodes ahead of time (used for massive scheduled game patches or OS updates).
2. **Cache Invalidation Strategies:**
   - **Never mutate an existing image URL!** Instead of overwriting `photo.jpg`, use **Content-Addressable Naming** or unique IDs (`yaadein-01.jpg`, `/api/memories/{unique_doc_id}/image`). Because each new upload gets a brand-new ID, you can safely cache every image as `immutable` forever!
3. **`ETag` vs. `Last-Modified`:**
   - `ETag` is a cryptographic hash (e.g., SHA-256) of the file bytes. Even if file timestamps change during a server redeploy, if the bytes are identical, the `ETag` matches and the server returns `304 Not Modified`.
4. **Why Client-Side Compression Before Upload?**
   - Saves **90–97% ingress bandwidth**, prevents mobile upload timeouts, reduces cloud storage costs by 15×, and guarantees fast LCP (Largest Contentful Paint) for readers.

---

## 7. How Instagram & Google Photos Handle Photos (Why 400 KB Beats 7 MB)

### The Slow-Internet Problem with 7 MB Photos
On a real-world mobile 4G connection indoors (**2 Mbps = 250 KB/s**):
- A **7 MB (7,000 KB)** image takes **28 seconds** to download!
- A **400 KB** Full-HD image loads in **0.4–1.2 seconds**.

### Why a 400 KB Image at 1920px Looks Identical to a 7 MB Original
1. **Screen Pixel Density Limit:**
   - A 15 MB phone camera image is ~4000×3000 (**12 Megapixels**).
   - A phone screen is ~1170px wide and a standard laptop screen is 1920×1080 (**2 Megapixels**).
   - Sending 12 Megapixels to a 2-Megapixel screen means 80% of the downloaded bytes are immediately discarded by the device's GPU!
2. **Perceptual Compression (Chroma Subsampling):**
   - Human eyes have far more rod cells (sensitive to *brightness/sharpness*) than cone cells (sensitive to *color differences*).
   - WebP and JPEG at `0.85` quality keep ~99% of high-frequency brightness edges while blending adjacent color blocks—achieving a **95% file size reduction** with zero visible quality loss.

### Progressive "Blur-Up" Loading in Lightbox (`Yaadein.jsx`)
When a user taps a photo to enlarge it:
1. **At `0 ms`:** The Lightbox immediately renders the **640px thumbnail (`~60 KB`)** that is *already* in browser memory from the gallery grid, stretched to fit with a subtle `1.5px` blur. The user never stares at a blank box!
2. **At `~300 ms`:** The **1920px Full-HD image (`~400 KB`)** finishes loading in the background (`onLoad`) and smoothly cross-fades over the thumbnail.

---

## 8. How Instagram Handles Videos (Adaptive Bitrate Streaming — HLS / DASH)

Never serve a raw 50 MB `.mp4` file directly to mobile users. Instead, platforms like Instagram, YouTube, and Netflix use **HLS (HTTP Live Streaming)**:
1. **Transcoding & Chunking:** On upload, the server slices the video into tiny **2-second segments** (`.ts` or `.m4s` files) at multiple resolutions (`360p`, `720p`, `1080p`).
2. **Manifest Playlist (`.m3u8`):** The video player downloads a tiny text playlist listing the URLs of each 2-second chunk.
3. **Adaptive Bitrate Switching:** The player downloads the first 2-second chunk at `360p` so playback starts in **0.2 seconds** without buffering, then automatically upgrades to `1080p` on chunk #2 if the user's connection speed is fast.

---

## 9. Databases vs. Object Storage (Firestore vs. Firebase Cloud Storage)

| Feature | Databases (Firestore / Realtime DB / SQL) | Object Storage (Firebase Storage / GCS / AWS S3) |
| :--- | :--- | :--- |
| **Designed For** | Structured JSON metadata (`caption`, `likes`, `status`) | Binary files (`.webp`, `.jpg`, `.mp3`, `.mp4`) |
| **Max Item Size** | 1 MB (Firestore) / 10 MB write (Realtime DB) | **5 Terabytes** per object |
| **Bandwidth Cost** | Expensive ($0.18–$1.00 / GB) | Cheap ($0.02 / GB + built-in Edge CDN) |

In [`memories.py`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/routers/memories.py), uploaded images are written to **Firebase Cloud Storage (`gen-lang-client-0899905004.firebasestorage.app`)** with immutable CDN headers, and fall back to native binary `bytes` blobs in Firestore (saving the 33% Base64 text bloat and fitting comfortably inside a single document with zero chunking).

---

## 10. Yaadein Video Architecture (Poster Extraction, HTTP `206` Streaming & Signed URL Upgrade Path)

### 1. Zero-Video-Bytes on Initial Page Load (`processVideoFile` in [`imageCompressor.js`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/utils/imageCompressor.js))
- When a user selects a video to upload, the browser uses an off-screen HTML5 `<video preload="metadata">` element to seek to `t = 1.0s`, snapshots the video frame onto an HTML5 `<canvas>`, and encodes a **640px `.webp` Poster Thumbnail (~60 KB)** plus extracts the exact `duration_seconds` (`0:45`).
- Both the **Masonry Grid (`All`)** and the **Video Theatre Table (`🎬 Videos`)** only load the 60 KB `.webp` poster image—zero megabytes of `.mp4` video are downloaded until a user actually clicks **Play**!

### 2. HTTP Byte-Range Streaming (`206 Partial Content` in [`memories.py`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/routers/memories.py))
- Mobile browsers (especially **iOS Safari**) refuse to play or scrub HTML5 `<video>` tags unless the server supports **HTTP Byte-Range Requests**.
- When the browser requests `GET /api/memories/{id}/video` with `Range: bytes=0-1048575`, [`get_memory_video`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/routers/memories.py#L261-L333) slices the requested byte range and returns:
  - Status: `206 Partial Content`
  - `Content-Range: bytes start-end/total`
  - `Accept-Ranges: bytes`
- This allows playback to start in **~0.5 seconds** and lets users jump ahead to any timestamp on the video scrubber without waiting for the entire file to download.

### 3. Zero-Migration Path from Option 1 (Proxy Upload) to Option 2 (Signed URL Upload)
- Currently (Option 1), videos up to **20 MB** are uploaded via `POST /api/memories` and stored at `yaadein/uploads/{doc_id}/video.mp4` in Firebase Cloud Storage (`storage_video_path`).
- When upgrading to **Option 2 (Direct Browser-to-GCS Signed URLs)** for 100 MB+ raw videos later:
  1. Add a lightweight endpoint `POST /api/memories/upload-url` that calls `storage_bucket.blob(f"yaadein/uploads/{doc_id}/video.mp4").generate_signed_url(version="v4", expiration=900, method="PUT")`.
  2. The browser `PUT`s the 100 MB `.mp4` directly to that Signed URL, then calls `POST /api/memories` with `storage_video_path`.
  3. Because the bucket path (`yaadein/uploads/{doc_id}/video.mp4`) and Firestore metadata schema are **100% identical**, all existing videos remain untouched with **zero migration needed**!


