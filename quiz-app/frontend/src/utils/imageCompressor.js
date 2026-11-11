/**
 * Instagram-Style Dual-Tier Media Processing Pipeline (Photos + Videos)
 *
 * System Design Architecture:
 * 1. Photos:
 *    - Full-HD Display Master (1920px max dimension, ~300–550 KB, WebP/JPEG @ 85% perceptual quality)
 *    - Fast Grid Thumbnail (640px max dimension, ~50–90 KB, WebP/JPEG @ 78% quality)
 * 2. Videos:
 *    - Validates file size (warns on >= 10 MB, blocks > 20 MB direct proxy limit)
 *    - Extracts a 640px `.webp` Poster Thumbnail (~50–80 KB) from t = 1.0s using HTML5 <video> + <canvas>
 *      so the gallery grid and video table load zero video bytes until the user clicks Play!
 *    - Extracts video duration (e.g. "0:45") and resolution (width × height).
 */

const MAX_DISPLAY_BYTES = 580 * 1024; // ~580 KB ceiling for Full-HD photos
export const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB max for Option 1 direct upload
export const WARN_VIDEO_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB threshold to show large-video warning

export function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds) {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const totalSec = Math.round(seconds);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function renderToDataUrl(source, sourceWidth, sourceHeight, maxDim, mimeType, quality) {
    let width = sourceWidth;
    let height = sourceHeight;
    if (width > maxDim || height > maxDim) {
        if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
        } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    let dataUrl = canvas.toDataURL(mimeType, quality);
    if (mimeType === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    const b64Len = dataUrl.split(',')[1]?.length || 0;
    const sizeBytes = Math.round((b64Len * 3) / 4);
    return { dataUrl, width: canvas.width, height: canvas.height, sizeBytes };
}

export function compressImageFile(
    file,
    { maxMasterDimension = 1920, thumbDimension = 640, masterQuality = 0.85 } = {}
) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type?.startsWith('image/')) {
            reject(new Error('Please select a valid image file (JPEG, PNG, WebP, HEIC).'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.onload = (event) => {
            const rawDataUrl = event.target.result;
            const img = new Image();
            img.onerror = () => reject(new Error('Could not decode image format.'));
            img.onload = () => {
                try {
                    const originalSizeBytes =
                        file.size || Math.round(((rawDataUrl.split(',')[1]?.length || 0) * 3) / 4);

                    // 1. Generate Fast Grid Thumbnail (~50–90 KB, 640px) for instant grid & Lightbox blur-up
                    const thumb = renderToDataUrl(
                        img,
                        img.width,
                        img.height,
                        thumbDimension,
                        'image/webp',
                        0.78
                    );

                    // 2. Generate Crisp Full-HD 1920px Display Master (~300–550 KB)
                    let quality = masterQuality;
                    let master = renderToDataUrl(
                        img,
                        img.width,
                        img.height,
                        maxMasterDimension,
                        'image/webp',
                        quality
                    );
                    while (master.sizeBytes > MAX_DISPLAY_BYTES && quality > 0.68) {
                        quality -= 0.05;
                        master = renderToDataUrl(
                            img,
                            img.width,
                            img.height,
                            maxMasterDimension,
                            'image/webp',
                            quality
                        );
                    }

                    const savedPct =
                        originalSizeBytes > master.sizeBytes
                            ? Math.round(
                                  ((originalSizeBytes - master.sizeBytes) / originalSizeBytes) * 100
                              )
                            : 0;

                    resolve({
                        mediaType: 'photo',
                        dataUrl: master.dataUrl,
                        thumbDataUrl: thumb.dataUrl,
                        width: master.width,
                        height: master.height,
                        originalSizeBytes,
                        compressedSizeBytes: master.sizeBytes,
                        thumbSizeBytes: thumb.sizeBytes,
                        savedPct,
                    });
                } catch (err) {
                    reject(err);
                }
            };
            img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Processes a selected video file:
 * 1. Validates size against MAX_VIDEO_UPLOAD_BYTES (20 MB) and flags warning if >= 10 MB.
 * 2. Extracts video dimensions, duration, and a 640px WebP poster frame thumbnail at t = ~1.0s.
 * 3. Encodes the video file as a Data URL for upload.
 */
export function processVideoFile(file, { thumbDimension = 640 } = {}) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type?.startsWith('video/')) {
            reject(new Error('Please select a valid video file (MP4, WebM, MOV).'));
            return;
        }

        if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
            reject(
                new Error(
                    `⚠️ Video is too large (${formatBytes(file.size)}). Direct uploads currently support videos up to ${formatBytes(MAX_VIDEO_UPLOAD_BYTES)} (~1–2 minutes). Tip: Trim the clip or send it via WhatsApp first to reduce its size.`
                )
            );
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        let settled = false;
        const cleanup = () => {
            try {
                URL.revokeObjectURL(objectUrl);
            } catch {
                // ignore
            }
        };

        const finishWithPoster = (thumbResult, durationSeconds, vWidth, vHeight) => {
            if (settled) return;
            settled = true;

            const reader = new FileReader();
            reader.onerror = () => {
                cleanup();
                reject(new Error('Failed to read video file bytes.'));
            };
            reader.onload = (ev) => {
                cleanup();
                const videoDataUrl = ev.target.result;
                resolve({
                    mediaType: 'video',
                    dataUrl: videoDataUrl,
                    previewObjectUrl: URL.createObjectURL(file),
                    thumbDataUrl: thumbResult.dataUrl,
                    width: vWidth || thumbResult.width,
                    height: vHeight || thumbResult.height,
                    durationSeconds: Math.round((durationSeconds || 0) * 10) / 10,
                    durationFormatted: formatDuration(durationSeconds || 0),
                    originalSizeBytes: file.size,
                    compressedSizeBytes: file.size,
                    thumbSizeBytes: thumbResult.sizeBytes,
                    isLargeVideoWarning: file.size >= WARN_VIDEO_UPLOAD_BYTES,
                });
            };
            reader.readAsDataURL(file);
        };

        const createFallbackPoster = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 640, 360);
            grad.addColorStop(0, '#132546');
            grad.addColorStop(1, '#091224');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 360);
            ctx.fillStyle = '#d4af37';
            ctx.font = 'bold 24px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎬 Yaadein Video Memory', 320, 185);
            const dataUrl = canvas.toDataURL('image/webp', 0.8);
            const b64Len = dataUrl.split(',')[1]?.length || 0;
            return { dataUrl, width: 640, height: 360, sizeBytes: Math.round((b64Len * 3) / 4) };
        };

        video.onerror = () => {
            // Even if the browser cannot decode the video preview frame (e.g., certain MOV codecs),
            // still allow uploading with a clean vintage fallback poster!
            finishWithPoster(createFallbackPoster(), 0, 1280, 720);
        };

        video.onloadedmetadata = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const seekTarget = duration > 1.2 ? 1.0 : Math.max(0.1, duration * 0.25);
            try {
                video.currentTime = seekTarget;
            } catch {
                finishWithPoster(
                    createFallbackPoster(),
                    duration,
                    video.videoWidth || 1280,
                    video.videoHeight || 720
                );
            }
        };

        video.onseeked = () => {
            try {
                const vWidth = video.videoWidth || 1280;
                const vHeight = video.videoHeight || 720;
                const thumb = renderToDataUrl(
                    video,
                    vWidth,
                    vHeight,
                    thumbDimension,
                    'image/webp',
                    0.8
                );
                finishWithPoster(
                    thumb,
                    Number.isFinite(video.duration) ? video.duration : 0,
                    vWidth,
                    vHeight
                );
            } catch {
                finishWithPoster(
                    createFallbackPoster(),
                    Number.isFinite(video.duration) ? video.duration : 0,
                    video.videoWidth || 1280,
                    video.videoHeight || 720
                );
            }
        };

        video.src = objectUrl;
    });
}
