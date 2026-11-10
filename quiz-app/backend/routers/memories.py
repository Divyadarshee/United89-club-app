import asyncio
import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from firebase_admin import firestore
from core.database import db, storage_bucket
from auth.dependencies import get_optional_current_user
from schemas.memories import MemoryCreateRequest, MemoryModerateRequest
from services.phone_service import normalize_phone

router = APIRouter(prefix="/api/memories", tags=["Yaadein Memories"])

ADMIN_PHONE = "9437555900"
MAX_DATA_URL_LENGTH = 2_500_000  # Supports up to ~1.8 MB payload (1920px Full-HD WebP is ~350-550 KB)
IMMUTABLE_CACHE_HEADER = "public, max-age=31536000, s-maxage=31536000, immutable"


def _is_admin_user(current_user: Optional[dict], query_phone: Optional[str] = None) -> bool:
    if current_user:
        if current_user.get("role") == "admin":
            return True
        sub = normalize_phone(str(current_user.get("sub") or ""))
        if sub == ADMIN_PHONE:
            return True
    if query_phone and normalize_phone(query_phone) == ADMIN_PHONE:
        return True
    return False


def _decode_data_url(data_url: str) -> Tuple[bytes, str]:
    """Decodes a `data:image/...;base64,...` string into `(raw_bytes, mime_type)`."""
    header, b64_payload = data_url.split(",", 1)
    mime_type = header.split(";")[0].replace("data:", "") or "image/webp"
    return base64.b64decode(b64_payload), mime_type


def _upload_to_cloud_storage(blob_path: str, binary_bytes: bytes, mime_type: str) -> Optional[str]:
    """
    Uploads binary image bytes to Firebase Cloud Storage (Object Storage) with immutable CDN headers.
    Returns the storage path on success, or None if the bucket is unavailable.
    """
    if not storage_bucket:
        return None
    try:
        blob = storage_bucket.blob(blob_path)
        blob.cache_control = IMMUTABLE_CACHE_HEADER
        blob.upload_from_string(binary_bytes, content_type=mime_type)
        return blob_path
    except Exception as exc:
        print(f"[Yaadein Storage] Cloud Storage upload skipped/fallback to Firestore Blob: {exc}")
        return None


def _download_from_cloud_storage(blob_path: str) -> Optional[bytes]:
    if not storage_bucket or not blob_path:
        return None
    try:
        blob = storage_bucket.blob(blob_path)
        return blob.download_as_bytes()
    except Exception as exc:
        print(f"[Yaadein Storage] Failed to read blob {blob_path}: {exc}")
        return None


def _delete_from_cloud_storage(blob_path: Optional[str]) -> None:
    if not storage_bucket or not blob_path:
        return
    try:
        blob = storage_bucket.blob(blob_path)
        blob.delete()
    except Exception:
        pass


def _serialize_memory_doc(doc_id: str, data: dict) -> dict:
    """
    Serializes a Firestore memory document into a lightweight metadata record.
    - `image_url`: Fast 640px Grid Thumbnail URL (`/api/memories/{doc_id}/thumb`) for smooth gallery scrolling & instant Lightbox blur-up.
    - `high_res_url`: Crisp 1920px Full-HD URL (`/api/memories/{doc_id}/image`) for enlarged Lightbox & Download.
    """
    created_at = data.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    elif not isinstance(created_at, str):
        created_at = datetime.now(timezone.utc).isoformat()

    raw_image = data.get("image_data_url") or ""
    has_binary_or_storage = bool(
        data.get("storage_full_path")
        or data.get("image_blob")
        or raw_image.startswith("data:image/")
    )

    if has_binary_or_storage:
        high_res_url = f"/api/memories/{doc_id}/image"
        image_url = f"/api/memories/{doc_id}/thumb"
    else:
        high_res_url = raw_image
        image_url = raw_image

    return {
        "id": doc_id,
        "caption": data.get("caption", ""),
        "image_url": image_url,
        "high_res_url": high_res_url,
        "storage_engine": data.get("storage_engine", "firestore_blob"),
        "uploader_name": data.get("uploader_name", "Club Member"),
        "uploader_phone": data.get("uploader_phone", ""),
        "status": data.get("status", "pending"),
        "likes": data.get("likes", 0),
        "width": data.get("width"),
        "height": data.get("height"),
        "size_bytes": data.get("size_bytes"),
        "created_at": created_at,
    }


@router.get("")
async def list_memories(
    user_phone: Optional[str] = Query(default=None, description="Optional viewer phone to include own pending uploads"),
    admin: bool = Query(default=False, description="Include all pending uploads for admin moderation"),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Returns Yaadein memories metadata list.
    - Admins see all approved and pending memories.
    - Regular members see all approved memories plus their own pending uploads.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    is_admin = admin or _is_admin_user(current_user, user_phone)
    viewer_norm_phone = normalize_phone(
        str((current_user or {}).get("sub") or user_phone or "")
    )

    docs = db.collection("memories").stream()
    items = []
    seed_overrides = {}
    async for doc in docs:
        data = doc.to_dict() or {}
        if data.get("is_seed_reaction") or doc.id.startswith("seed-"):
            seed_overrides[doc.id] = {
                "likes": max(0, int(data.get("likes") or 0)),
                **(
                    {"caption": data["caption"]}
                    if "caption" in data and data["caption"] is not None
                    else {}
                ),
                **({"hidden": bool(data.get("hidden"))} if "hidden" in data else {}),
            }
            continue
        status = data.get("status", "pending")
        uploader_norm = normalize_phone(str(data.get("uploader_phone") or ""))

        if status == "rejected":
            continue

        if is_admin or status == "approved" or (viewer_norm_phone and uploader_norm == viewer_norm_phone):
            items.append(_serialize_memory_doc(doc.id, data))

    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": items, "seed_overrides": seed_overrides, "is_admin": is_admin}


@router.get("/{memory_id}/thumb")
async def get_memory_thumbnail(memory_id: str, request: Request):
    """
    Serves the fast ~60 KB 640px Grid Thumbnail with 1-year immutable CDN Cache-Control.
    Reads from Firebase Cloud Storage (Object Storage) or native Firestore binary blob.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc = await db.collection("memories").document(memory_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Memory not found")

    data = doc.to_dict() or {}
    mime_type = data.get("thumb_mime_type") or data.get("mime_type") or "image/webp"
    binary_bytes: Optional[bytes] = None

    # 1. Check Firebase Cloud Storage (Object Storage) first
    storage_thumb_path = data.get("storage_thumb_path") or data.get("storage_full_path")
    if storage_thumb_path:
        binary_bytes = await asyncio.to_thread(_download_from_cloud_storage, storage_thumb_path)

    # 2. Fallback to native binary blob or legacy data URL in Firestore
    if not binary_bytes:
        blob = data.get("thumb_blob") or data.get("image_blob")
        if blob:
            binary_bytes = bytes(blob)
        else:
            raw_data_url = data.get("thumb_data_url") or data.get("image_data_url") or ""
            if raw_data_url.startswith("data:image/"):
                binary_bytes, mime_type = _decode_data_url(raw_data_url)

    if not binary_bytes:
        raise HTTPException(status_code=404, detail="Thumbnail unavailable")

    etag = f'"thumb-{hashlib.sha256(binary_bytes).hexdigest()[:28]}"'
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={
                "ETag": etag,
                "Cache-Control": IMMUTABLE_CACHE_HEADER,
            },
        )

    return Response(
        content=binary_bytes,
        media_type=mime_type,
        headers={
            "ETag": etag,
            "Cache-Control": IMMUTABLE_CACHE_HEADER,
        },
    )


@router.get("/{memory_id}/image")
async def get_memory_image(memory_id: str, request: Request):
    """
    Serves the crisp 1920px Full-HD image (~350–550 KB) with immutable CDN Cache-Control and ETag.
    Reads from Firebase Cloud Storage (Object Storage) or native Firestore binary blob.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    doc_ref = db.collection("memories").document(memory_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Memory image not found")

    data = doc.to_dict() or {}
    mime_type = data.get("mime_type") or "image/webp"
    binary_bytes: Optional[bytes] = None

    # 1. Check Firebase Cloud Storage (Object Storage) first
    storage_full_path = data.get("storage_full_path")
    if storage_full_path:
        binary_bytes = await asyncio.to_thread(_download_from_cloud_storage, storage_full_path)

    # 2. Check native binary blob in Firestore
    if not binary_bytes and data.get("image_blob"):
        binary_bytes = bytes(data["image_blob"])

    # 3. Legacy data URL support
    if not binary_bytes:
        raw_data_url = data.get("image_data_url") or ""
        if raw_data_url.startswith("data:image/"):
            binary_bytes, mime_type = _decode_data_url(raw_data_url)

    if not binary_bytes:
        raise HTTPException(status_code=404, detail="Memory image unavailable")

    etag = f'"{hashlib.sha256(binary_bytes).hexdigest()[:32]}"'
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={
                "ETag": etag,
                "Cache-Control": IMMUTABLE_CACHE_HEADER,
            },
        )

    return Response(
        content=binary_bytes,
        media_type=mime_type,
        headers={
            "ETag": etag,
            "Cache-Control": IMMUTABLE_CACHE_HEADER,
        },
    )


@router.post("")
async def create_memory(
    payload: MemoryCreateRequest,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Uploads a new photo memory to Yaadein using Instagram-style Dual-Tier sizing:
    - 1920px Full-HD Display Master (~350–550 KB WebP)
    - 640px Grid Thumbnail (~50–90 KB WebP)
    Stores the binary files in Firebase Cloud Storage (Object Storage) when available,
    with seamless fallback to compact native binary blobs in a single Firestore document.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if len(payload.image_data_url) > MAX_DATA_URL_LENGTH:
        raise HTTPException(
            status_code=413,
            detail="Image payload too large. Please select a standard photo.",
        )

    uploader_phone = normalize_phone(
        str((current_user or {}).get("sub") or payload.uploader_phone or "")
    )
    is_admin = _is_admin_user(current_user, uploader_phone)
    initial_status = "approved" if is_admin else "pending"

    now_iso = datetime.now(timezone.utc).isoformat()
    doc_ref = db.collection("memories").document()
    doc_id = doc_ref.id

    storage_full_path = None
    storage_thumb_path = None
    image_blob = None
    thumb_blob = None
    mime_type = "image/webp"
    thumb_mime_type = "image/webp"

    if payload.image_data_url.startswith("data:image/"):
        full_bytes, mime_type = _decode_data_url(payload.image_data_url)
        ext = "webp" if "webp" in mime_type else "jpg"

        if payload.thumb_data_url and payload.thumb_data_url.startswith("data:image/"):
            t_bytes, thumb_mime_type = _decode_data_url(payload.thumb_data_url)
        else:
            t_bytes, thumb_mime_type = full_bytes, mime_type

        # Attempt Firebase Cloud Storage (Object Storage) upload first
        storage_full_path = await asyncio.to_thread(
            _upload_to_cloud_storage,
            f"yaadein/uploads/{doc_id}/full.{ext}",
            full_bytes,
            mime_type,
        )
        if storage_full_path:
            storage_thumb_path = await asyncio.to_thread(
                _upload_to_cloud_storage,
                f"yaadein/uploads/{doc_id}/thumb.{ext}",
                t_bytes,
                thumb_mime_type,
            )
        else:
            # Store compact binary bytes directly (saves 33% Base64 overhead, fits in 1 doc!)
            image_blob = full_bytes
            thumb_blob = t_bytes

    doc_data = {
        "caption": (payload.caption or "").strip(),
        "storage_engine": "firebase_storage" if storage_full_path else "firestore_blob",
        "storage_full_path": storage_full_path,
        "storage_thumb_path": storage_thumb_path,
        "image_blob": image_blob,
        "thumb_blob": thumb_blob,
        "image_data_url": "" if (storage_full_path or image_blob) else payload.image_data_url,
        "mime_type": mime_type,
        "thumb_mime_type": thumb_mime_type,
        "uploader_name": (payload.uploader_name or "Club Member").strip() or "Club Member",
        "uploader_phone": uploader_phone,
        "status": initial_status,
        "likes": 0,
        "width": payload.width,
        "height": payload.height,
        "size_bytes": payload.size_bytes,
        "created_at": now_iso,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    await doc_ref.set(doc_data)

    return {
        "status": "success",
        "message": "Memory published!" if initial_status == "approved" else "Memory submitted for admin approval!",
        "memory": _serialize_memory_doc(doc_id, doc_data),
    }


@router.patch("/{memory_id}")
async def moderate_memory(
    memory_id: str,
    payload: MemoryModerateRequest,
    admin_phone: Optional[str] = Query(default=None),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Admin-ONLY endpoint to approve/reject a pending memory or update its caption/tag.
    Regular members cannot edit tags/captions after upload.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not _is_admin_user(current_user, admin_phone):
        raise HTTPException(status_code=403, detail="Only Admin can edit tags or moderate memories")

    doc_ref = db.collection("memories").document(memory_id)
    doc = await doc_ref.get()
    if not doc.exists:
        if memory_id.startswith("seed-"):
            seed_data = {
                "is_seed_reaction": True,
                "likes": 0,
                "caption": (payload.caption or "").strip() if payload.caption is not None else None,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
            await doc_ref.set(seed_data, merge=True)
            return {"status": "success", "memory": {"id": memory_id, "caption": seed_data["caption"]}}
        raise HTTPException(status_code=404, detail="Memory not found")

    updates = {"updated_at": firestore.SERVER_TIMESTAMP}
    if payload.status in ("approved", "pending", "rejected"):
        updates["status"] = payload.status
    if payload.caption is not None:
        updates["caption"] = payload.caption.strip()

    await doc_ref.update(updates)
    updated_doc = await doc_ref.get()
    return {
        "status": "success",
        "memory": _serialize_memory_doc(memory_id, updated_doc.to_dict() or {}),
    }


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    user_phone: Optional[str] = Query(default=None),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Admin-ONLY endpoint to delete a memory (and its Cloud Storage objects if present).
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    requester_phone = normalize_phone(
        str((current_user or {}).get("sub") or user_phone or "")
    )
    if not _is_admin_user(current_user, requester_phone):
        raise HTTPException(status_code=403, detail="Only Admin can delete memories")

    doc_ref = db.collection("memories").document(memory_id)
    doc = await doc_ref.get()
    if memory_id.startswith("seed-"):
        await doc_ref.set(
            {"is_seed_reaction": True, "hidden": True, "updated_at": firestore.SERVER_TIMESTAMP},
            merge=True,
        )
        return {"status": "success", "deleted_id": memory_id}

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Memory not found")

    data = doc.to_dict() or {}
    if data.get("storage_full_path"):
        await asyncio.to_thread(_delete_from_cloud_storage, data.get("storage_full_path"))
    if data.get("storage_thumb_path"):
        await asyncio.to_thread(_delete_from_cloud_storage, data.get("storage_thumb_path"))

    await doc_ref.delete()
    return {"status": "success", "deleted_id": memory_id}


@router.post("/{memory_id}/like")
async def like_memory(
    memory_id: str,
    unlike: bool = Query(default=False, description="Set true to remove like and decrement counter"),
):
    """
    Toggles the heart/nostalgia reaction counter on a memory (+1 on like, -1 on unlike, never below 0).
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    delta = -1 if unlike else 1
    doc_ref = db.collection("memories").document(memory_id)
    doc = await doc_ref.get()
    if not doc.exists:
        if memory_id.startswith("seed-"):
            initial_likes = 0 if unlike else 1
            await doc_ref.set({
                "is_seed_reaction": True,
                "likes": initial_likes,
                "updated_at": firestore.SERVER_TIMESTAMP,
            })
            return {"status": "success", "id": memory_id, "likes": initial_likes}
        raise HTTPException(status_code=404, detail="Memory not found")

    data = doc.to_dict() or {}
    current_likes = max(0, int(data.get("likes") or 0))
    new_likes = max(0, current_likes + delta)
    await doc_ref.update({"likes": new_likes, "updated_at": firestore.SERVER_TIMESTAMP})
    return {"status": "success", "id": memory_id, "likes": new_likes}
