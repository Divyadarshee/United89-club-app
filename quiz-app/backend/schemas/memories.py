from pydantic import BaseModel, Field
from typing import Optional


class MemoryCreateRequest(BaseModel):
    media_type: Optional[str] = Field(default="photo", description="photo | video")
    caption: Optional[str] = Field(default="", max_length=300)
    image_data_url: Optional[str] = Field(
        default="",
        description="1920px Full-HD display image data URL (~300-550 KB) or video data URL",
    )
    video_data_url: Optional[str] = Field(
        default=None,
        description="Video data URL (up to 20 MB binary) when media_type == 'video'",
    )
    thumb_data_url: Optional[str] = Field(
        default=None,
        description="640px fast grid thumbnail / video poster frame data URL (~50-90 KB)",
    )
    uploader_name: Optional[str] = Field(default="Club Member", max_length=100)
    uploader_phone: Optional[str] = Field(default="", max_length=30)
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None


class MemoryModerateRequest(BaseModel):
    status: Optional[str] = Field(default=None, description="approved | pending | rejected")
    caption: Optional[str] = Field(default=None, max_length=300)
