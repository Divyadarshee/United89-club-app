# Chapter 15: System Design Interview Cheat Sheet

> *"In system design interviews, there are no right answers—only trade-offs. The engineer who can articulate the numbers, boundaries, and trade-offs wins the offer."*

---

## 1. Numbers Every Engineer Must Know

When an interviewer asks you to estimate bandwidth, storage, or latency for a media service (like Instagram, Pinterest, or Yaadein), memorize these baseline numbers:

### Latency Numbers (Human Scale)
- **L1 CPU Cache Reference:** $0.5\text{ ns}$
- **Main RAM Access:** $100\text{ ns}$
- **Solid-State Disk (NVMe SSD) Read:** $50\text{ to }100\text{ µs}$ ($1,000\times$ slower than RAM)
- **Intra-Datacenter Network Round Trip:** $0.5\text{ ms}$
- **CDN Edge PoP in Same Metro City:** **$5\text{ to }15\text{ ms}$**
- **Speed of Light in Fiber Optic Glass:** $200\text{ km/ms}$ ($200,000\text{ km/s}$)
- **Cross-Continental Round Trip (India $\to$ USA):** **$180\text{ to }240\text{ ms}$**

### Storage & Media Numbers
- **Base64 Encoding Overhead:** **$+33.3\%$** ($4$ characters for every $3$ raw bytes).
- **Uncompressed GPU Texture Memory:** $\text{Width} \times \text{Height} \times 4\text{ bytes (RGBA)}$.
  - A $4000 \times 3000$ camera photo $= \mathbf{48\text{ MB of active RAM}}$ to render on screen!
- **WebP vs. JPEG Efficiency:** WebP provides **$25\%\text{ to }34\%$ smaller file size** than JPEG at equivalent SSIM quality index.
- **Cache Hit Ratio (Target):** Production media CDNs aim for **$\ge 98\%$ Cache Hit Ratio**.

---

## 2. Master Trade-Off Matrices

---

### Matrix 1: Pull CDN vs. Push CDN
| Attribute | Pull CDN (Read-Through Cache) | Push CDN (Proactive Distribution) |
| :--- | :--- | :--- |
| **Ingestion** | On-demand on first cache miss | Bulk upload ahead of time via API/FTP |
| **Edge Storage Used** | Minimal (only requested hot files) | High (100% of files stored across all PoPs) |
| **Best Used For** | Web applications, photo albums, e-commerce, news sites | Massive game patches (Fortnite 25 GB), OS updates (iOS) |
| **Implementation** | Cloudflare, Google Cloud CDN, Fastly | Akamai Push, custom edge staging |

---

### Matrix 2: Client-Side vs. Server-Side Compression
| Attribute | Client-Side In-Browser (`imageCompressor.js`) | Server-Side Container (Pillow / Sharp) |
| :--- | :--- | :--- |
| **Ingress Bandwidth** | **Saves 80–95% data over mobile uplink** | Full raw camera file (25 MB) must be uploaded |
| **Compute Cost** | **\$0.00 (Runs on user's phone CPU/GPU)** | High CPU utilization and RAM billing |
| **User Experience** | Instant preview + fast upload progress | Slow upload bar, frequent mobile network timeouts |
| **Trade-Off** | Relies on browser canvas capabilities | Fully controllable server environment |

---

### Matrix 3: Metadata DB + CDN URLs vs. Inline Base64
| Attribute | Metadata DB + CDN URLs (Our Pattern) | Inline Base64 in JSON List |
| :--- | :--- | :--- |
| **List API Payload** | **~25 KB for 100 photos** | **~26.6 MB for 100 photos** |
| **Browser Parse Time** | **< 2 milliseconds** | **1,500 – 3,000 milliseconds (Main thread freezes!)** |
| **Cacheability** | **100% cached at CDN edge via immutable URLs** | Uncacheable (dynamic list with likes/comments) |
| **Bandwidth Efficiency** | Only loads visible images (`loading="lazy"`) | Downloads 100% of images even if user leaves instantly |

---

### Matrix 4: Object Storage (S3/GCS) vs. Subcollection Chunking
| Attribute | Cloud Object Storage (S3 / GCS) | Firestore Subcollection Chunking (`memories.py`) |
| :--- | :--- | :--- |
| **Architecture** | Separate storage bucket service | 100% self-contained within transactional database |
| **Infra Complexity** | Requires bucket IAM, CORS rules, signed URL keys | Zero extra external setup or credentials |
| **Document Limit** | Unlimited (up to 5 TB per object) | Bypasses 1 MiB limit via 750 KB indexed slices |
| **Lifecycle** | Separate bucket cleanup lifecycle | Atomic cascade deletion with parent document |

---

### Matrix 5: Image Formats Comparison
| Format | Compression | Transparency (Alpha) | Browser Support | Best Role in System Design |
| :--- | :--- | :--- | :--- | :--- |
| **WebP** | Lossy & Lossless | Yes | 97%+ Modern Browsers | **Tier 1 Grid Thumbnails (~140 KB)** |
| **JPEG** | Lossy | No | 100% Universal | **Tier 2 High-Res 4K Masters (Print/Download)** |
| **PNG** | Lossless | Yes | 100% Universal | UI icons, line art, transparent graphics |
| **AVIF** | Next-gen Lossy | Yes | ~93% Modern Browsers | Future replacement for WebP (higher encode CPU) |

---

## 3. Top 10 System Design Interview Questions & Model Answers

### Q1: "How would you design the storage and delivery architecture for an Instagram-like photo feed?"
> **Model Answer:**  
> "I would strictly separate the **Metadata layer** from the **Blob storage layer**. The feed API (`GET /feed`) returns lightweight JSON containing post metadata, captions, like counts, and immutable image CDN URLs (~20 KB total).  
> For the media pipeline, I would use a **Dual-Tier architecture**: on client upload, we generate a fast 900px WebP grid thumbnail (~140 KB) and a 4K master (~5 MB). The feed renders only thumbnails using native HTML `loading="lazy"` and `decoding="async"`, keeping LCP under 1 second. The 4K master is fetched on-demand only when a user taps into full-screen.  
> Images are served via a **Pull CDN** with `Cache-Control: public, max-age=31536000, immutable` and strong SHA-256 ETags. This guarantees a 99%+ Cache Hit Ratio and shields origin storage."

---

### Q2: "Does a CDN store every file forever? How does eviction work?"
> **Model Answer:**  
> "No. A CDN is an ephemeral, distributed **Read-Through Cache**, not permanent origin storage. Edge PoPs have finite high-speed RAM and NVMe SSD capacity.  
> Eviction is governed by two triggers:
> 1. **TTL Expiry (`max-age` / `s-maxage`):** Marks objects as stale once their time expires, triggering a conditional 304 validation on the next request.
> 2. **Memory Pressure (LRU / LFU Eviction):** When edge disks fill up, cold assets that have not been accessed recently are evicted from the edge.  
> If an asset is evicted, it is never lost—it resides permanently at the durable Origin. The next request simply incurs a single transparent Cache Miss and repopulates the local edge cache."

---

### Q3: "Why should you never mutate an asset under an existing URL?"
> **Model Answer:**  
> "Mutating an asset under an existing URL (e.g. overwriting `avatar.jpg`) causes catastrophic cache synchronization bugs. Browsers and intermediate CDN edge nodes cache assets according to their `max-age`. If the origin changes the file, hundreds of global edge nodes will serve split-brain stale versions, and the client browser will not even check the network.  
> Instead, we use **Content-Addressable or Unique URLs** (e.g. `/api/memories/{unique_uuid}/thumb` or `avatar.a8f9c1.jpg`). Because the URL is immutable, we can safely set 1-year cache headers (`max-age=31536000, immutable`) with zero risk of stale data."

---

### Q4: "How does the HTTP 304 Not Modified handshake save bandwidth?"
> **Model Answer:**  
> "When an asset is first delivered, the origin calculates a cryptographic hash (like SHA-256) of the binary bytes and returns it in the `ETag` header. When the client's cache expires, it sends a conditional request with `If-None-Match: "<ETag>"`.  
> The server computes the hash of the current file. If the hashes match, the server returns an HTTP `304 Not Modified` with **zero bytes of image body**. This saves 100% of media bandwidth, turning a 6 MB transfer into a 200-byte header ping."

---

### Q5: "What is the Base64 tax and why is it dangerous in list APIs?"
> **Model Answer:**  
> "Base64 converts 3 binary bytes into 4 printable ASCII characters, introducing an unavoidable **+33.3% size penalty**.  
> If you embed Base64 images directly inside a list API like `GET /api/memories`, returning 100 photos creates a 26 MB JSON response. Parsing 26 MB of JSON freezes the mobile JavaScript main thread for 2 seconds and risks Out-Of-Memory (OOM) tab crashes. Furthermore, dynamic list APIs cannot be cached long-term at the CDN edge."

---

### Q6: "How do you bypass document size limits in databases like Firestore or DynamoDB?"
> **Model Answer:**  
> "Databases like Firestore enforce a hard 1 MiB limit per document. If external object storage (S3/GCS) is not available, we implement a **Subcollection Binary Chunking Engine**.  
> On upload, if the binary exceeds our inline threshold (480 KB), we slice the binary into 750 KB safe chunks and write them to a subcollection (`memories/{id}/chunks/chunk_{idx}`). On read, we query the subcollection ordered by index, concatenate the byte slices (`b''.join(parts)`), and return the unified binary with 1-year immutable CDN headers. The CDN caches the unified binary, so chunk reassembly only happens once!"

---

### Q7: "Why do we perform image downsampling on client devices before upload?"
> **Model Answer:**  
> "Client-side downsampling using HTML5 Canvas offloads 100% of compute work to the user's multi-core phone CPU/GPU. It reduces mobile uplink payloads from 25 MB camera RAWs down to ~150 KB thumbnails and ~5 MB masters. This prevents mobile network timeouts, eliminates server CPU bottlenecks, and cuts cloud container costs to near zero."

---

### Q8: "How does Dual-Tier media delivery prevent mobile browser crashes?"
> **Model Answer:**  
> "Compressed JPEG/WebP files must be decompressed into uncompressed RGBA pixel buffers in GPU memory to render on screen ($4000 \times 3000 \times 4\text{ bytes} = 48\text{ MB RAM}$ per photo). Rendering 50 raw photos requires 2.4 GB of RAM, causing Mobile Safari/Chrome to crash.  
> Dual-Tier solves this: the gallery grid downloads only 900px WebP thumbnails (~140 KB file size, ~3 MB GPU RAM). The 4K master is loaded on-demand only when opening the lightbox or downloading."

---

### Q9: "What is the difference between `max-age` and `s-maxage`?"
> **Model Answer:**  
> "`max-age` specifies how long the **end-user's browser** is allowed to cache the asset. `s-maxage` (Shared max-age) is specifically read by **intermediate public shared caches**, such as CDN Edge PoPs. If `s-maxage` is present, CDNs obey `s-maxage` and ignore `max-age`."

---

### Q10: "How do you optimize Largest Contentful Paint (LCP) in an image-heavy web application?"
> **Model Answer:**  
> "To optimize LCP:
> 1. Set `loading='eager'` on the first 4–6 images above the fold so they receive immediate network priority, and set `loading='lazy'` on all remaining below-the-fold images.
> 2. Add `decoding='async'` to decompress image bytes on background threads without blocking UI scrolling.
> 3. Serve modern WebP thumbnails via local CDN Edge PoPs (10ms latency).
> 4. Use native CSS multi-column masonry (`columns-1 sm:columns-2 lg:columns-3 break-inside-avoid`) instead of heavy JavaScript layout libraries."

---

## 4. Production Repository Reference Index

All principles in this course are implemented and fully verifiable in our repository:

| Architectural Component | Source Code File Link |
| :--- | :--- |
| **Frontend Gallery & Lightbox** | [`quiz-app/frontend/src/pages/Yaadein.jsx`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/pages/Yaadein.jsx) |
| **Client-Side Image Compressor** | [`quiz-app/frontend/src/utils/imageCompressor.js`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/frontend/src/utils/imageCompressor.js) |
| **FastAPI Backend & Chunking Router** | [`quiz-app/backend/routers/memories.py`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/backend/routers/memories.py) |
| **Firebase CDN Hosting Configuration** | [`quiz-app/firebase.json`](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/quiz-app/firebase.json) |

---

### Congratulations! 🎉
You have completed the entire 15-chapter **CDN & Media System Design Course**. You now possess the architectural foundation and hands-on code knowledge to design, build, and scale world-class media applications!

[$\leftarrow$ Return to Course Index (`00-INDEX.md`)](file:///Users/divyadarshee.das/Desktop/Pers/United89-club-app/docs/cdn-system-design-course/00-INDEX.md)
