from pydantic import BaseModel, Field
from typing import Optional


class MemoryCreateRequest(BaseModel):
    caption: Optional[str] = Field(default="", max_length=300)
    image_data_url: str = Field(..., description="1920px Full-HD display image data URL (~300-550 KB) or public URL")
    thumb_data_url: Optional[str] = Field(default=None, description="640px fast grid thumbnail data URL (~50-90 KB)")
    uploader_name: Optional[str] = Field(default="Club Member", max_length=100)
    uploader_phone: Optional[str] = Field(default="", max_length=30)
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None


class MemoryModerateRequest(BaseModel):
    status: Optional[str] = Field(default=None, description="approved | pending | rejected")
    caption: Optional[str] = Field(default=None, max_length=300)
