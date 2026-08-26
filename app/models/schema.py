import warnings
from enum import Enum
from typing import Any, List, Literal, Optional, Union

import pydantic
from pydantic import BaseModel, ConfigDict, Field

from app.config import config

# Suppress specific Pydantic warnings
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    message="Field name.*shadows an attribute in parent.*",
)


class VideoConcatMode(str, Enum):
    random = "random"
    sequential = "sequential"


class VideoTransitionMode(str, Enum):
    none = None
    shuffle = "Shuffle"
    fade_in = "FadeIn"
    fade_out = "FadeOut"
    slide_in = "SlideIn"
    slide_out = "SlideOut"
    zoom_in = "ZoomIn"
    zoom_out = "ZoomOut"


class VideoAspect(str, Enum):
    landscape = "16:9"
    portrait = "9:16"
    square = "1:1"

    def to_resolution(self):
        if self == VideoAspect.landscape:
            return 1920, 1080
        elif self == VideoAspect.portrait:
            return 1080, 1920
        elif self == VideoAspect.square:
            return 1080, 1080
        raise ValueError(f"unsupported video aspect: {self}")


_Config = ConfigDict(
    arbitrary_types_allowed=True,
    # Note: ensure your key names match renamed V2 parameters if needed
)


@pydantic.dataclasses.dataclass(config=_Config)
class MaterialInfo:
    provider: str = "pexels"
    url: str = ""
    duration: int = 0
    # Online material searches include sanitized public source info for caching and task records.
    # Local uploads do not require this; records are reconstructed against a whitelist before persistence.
    source_info: Optional[dict[str, Any]] = None


class VideoParams(BaseModel):
    """
    {
      "video_subject": "Scenic mountain sunset",
      "video_aspect": "9:16",
      "voice_name": "en-US-AriaNeural-Female",
      "bgm_name": "random",
      "font_name": "STHeitiMedium.ttc",
      "text_color": "#FFFFFF",
      "font_size": 60,
      "stroke_color": "#000000",
      "stroke_width": 1.5
    }
    """

    video_subject: str
    video_script: str = ""  # Script used to generate the video
    video_terms: Optional[str | list] = None  # Keywords used to generate the video
    video_aspect: Optional[VideoAspect] = VideoAspect.portrait.value
    video_concat_mode: Optional[VideoConcatMode] = VideoConcatMode.random.value
    video_transition_mode: Optional[VideoTransitionMode] = None
    video_clip_duration: int = Field(default=5, ge=1)
    video_clip_speed: Optional[float] = 1.0
    match_materials_to_script: bool = False
    video_count: int = Field(default=1, ge=1)

    video_source: Optional[str] = "pexels"
    video_materials: Optional[List[MaterialInfo]] = (
        None  # Materials used to generate the video
    )
    studio_project_id: Optional[str] = ""
    studio_stock_source: Optional[str] = "pexels"
    studio_blend_mode: Optional[str] = "blend"

    custom_audio_file: Optional[str] = (
        None  # Custom audio file path, will ignore TTS and can still use Whisper subtitles
    )
    video_language: Optional[str] = ""  # auto detect

    voice_name: Optional[str] = ""
    voice_volume: Optional[float] = 1.0
    voice_rate: Optional[float] = 1.0
    bgm_type: Optional[str] = "random"
    bgm_file: Optional[str] = ""
    bgm_volume: Optional[float] = 0.2
    # Unified music prompt shared across music providers.
    video_music_prompt: str = Field(default="", max_length=2000)
    sonilo_bgm_prompt: str = Field(default="", max_length=2000)

    subtitle_enabled: Optional[bool] = True
    subtitle_position: Optional[str] = config.ui.get(
        "subtitle_position", "bottom"
    )  # top, bottom, center, custom
    custom_position: float = config.ui.get("custom_position", 70.0)
    font_name: Optional[str] = "STHeitiMedium.ttc"
    text_fore_color: Optional[str] = "#FFFFFF"
    text_background_color: Union[bool, str] = False
    rounded_subtitle_background: bool = False

    font_size: int = 60
    stroke_color: Optional[str] = "#000000"
    stroke_width: float = 1.5
    n_threads: Optional[int] = 2
    paragraph_number: int = Field(default=1, ge=1, le=10)
    video_script_prompt: str = Field(default="", max_length=2000)
    custom_system_prompt: str = Field(default="", max_length=8000)


class SubtitleRequest(BaseModel):
    video_script: str
    video_language: Optional[str] = ""
    voice_name: Optional[str] = "en-US-AriaNeural-Female"
    voice_volume: Optional[float] = 1.0
    voice_rate: Optional[float] = 1.2
    bgm_type: Optional[str] = "random"
    bgm_file: Optional[str] = ""
    bgm_volume: Optional[float] = 0.2
    subtitle_position: Optional[str] = config.ui.get("subtitle_position", "bottom")
    font_name: Optional[str] = "STHeitiMedium.ttc"
    text_fore_color: Optional[str] = "#FFFFFF"
    text_background_color: Union[bool, str] = False
    rounded_subtitle_background: bool = False
    font_size: int = 60
    stroke_color: Optional[str] = "#000000"
    stroke_width: float = 1.5
    video_source: Optional[str] = "local"
    subtitle_enabled: Optional[str] = "true"


class AudioRequest(BaseModel):
    video_script: str
    video_language: Optional[str] = ""
    voice_name: Optional[str] = "en-US-AriaNeural-Female"
    voice_volume: Optional[float] = 1.0
    voice_rate: Optional[float] = 1.2
    bgm_type: Optional[str] = "random"
    bgm_file: Optional[str] = ""
    bgm_volume: Optional[float] = 0.2
    video_source: Optional[str] = "local"


class VideoScriptParams:
    """
    {
      "video_subject": "Spring blooming flowers",
      "video_language": "",
      "paragraph_number": 1,
      "video_script_prompt": "",
      "custom_system_prompt": ""
    }
    """

    video_subject: Optional[str] = "Spring blooming flowers"
    video_language: Optional[str] = ""
    paragraph_number: int = Field(default=1, ge=1, le=10)
    video_script_prompt: str = Field(default="", max_length=2000)
    custom_system_prompt: str = Field(default="", max_length=8000)


class VideoTermsParams:
    """
    {
      "video_subject": "",
      "video_script": "",
      "amount": 5,
      "match_materials_to_script": false
    }
    """

    video_subject: Optional[str] = "Spring blooming flowers"
    video_script: Optional[str] = (
        "Spring blooming flowers unfold like a picturesque landscape. In this season of renewal, nature awakens with vibrant colors..."
    )
    amount: Optional[int] = 5
    match_materials_to_script: bool = False


class VideoSocialMetadataParams:
    """
    {
      "video_subject": "A day in Shanghai",
      "video_script": "",
      "language": "auto",
      "platform": "youtube"
    }
    """

    video_subject: Optional[str] = Field(default="A day in Shanghai", max_length=500)
    video_script: Optional[str] = Field(default="", max_length=8000)
    language: Optional[str] = Field(default="auto", max_length=64)
    platform: Optional[str] = Field(default="youtube", max_length=64)


class TaskVideoRequest(VideoParams, BaseModel):
    pass


class TaskQueryRequest(BaseModel):
    pass


class VideoScriptRequest(VideoScriptParams, BaseModel):
    pass


class VideoTermsRequest(VideoTermsParams, BaseModel):
    pass


class VideoSocialMetadataRequest(VideoSocialMetadataParams, BaseModel):
    pass


# ---------------------------
# ----- RESPONSE MODELS -----
# ---------------------------
class BaseResponse(BaseModel):
    status: int = 200
    message: Optional[str] = "success"
    data: Any = None


# ---- DATA MODELS ----
class TaskResponseData(BaseModel):
    task_id: str


class TaskStatusData(BaseModel):
    """Stable fields guaranteed for task status queries; extra/legacy fields pass through unchanged."""

    model_config = ConfigDict(extra="allow")

    task_id: str
    state: int
    progress: int = 0
    videos: Optional[List[str]] = None
    combined_videos: Optional[List[str]] = None
    failed_stage: Optional[str] = None
    error: Optional[str] = None
    cross_post_state: Optional[
        Literal["pending", "processing", "complete", "failed"]
    ] = None
    cross_post_results: Optional[List[dict[str, Any]]] = None
    cross_post_error: Optional[str] = None


class TaskListData(BaseModel):
    """Paginated task list structure."""

    tasks: List[TaskStatusData]
    total: int
    page: int
    page_size: int


class VideoScriptData(BaseModel):
    video_script: str


class VideoTermsData(BaseModel):
    video_terms: List[str]


class VideoSocialMetadataData(BaseModel):
    title: str
    caption: str
    hashtags: List[str]


class FileData(BaseModel):
    name: str
    size: int
    file: str


class BgmRetrieveData(BaseModel):
    files: List[FileData]


class BgmUploadData(BaseModel):
    file: str


class VideoMaterialRetrieveData(BaseModel):
    files: List[FileData]


class VideoMaterialUploadData(BaseModel):
    file: str


# ---- RESPONSE MODELS ----
class TaskResponse(BaseResponse):
    data: TaskResponseData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "task_id": "6c85c8cc-a77a-42b9-bc30-947815aa0558",
                },
            },
        }
    )


class TaskQueryResponse(BaseResponse):
    """
    Task status query returning generation state and optional publishing state.

    Failure responses include `failed_stage` and `error`.
    """

    data: TaskStatusData

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "status": 200,
                    "message": "success",
                    "data": {
                        "task_id": "6c85c8cc-a77a-42b9-bc30-947815aa0558",
                        "state": 1,
                        "progress": 100,
                        "videos": ["/tasks/example/final-1.mp4"],
                        "cross_post_state": "complete",
                        "cross_post_results": [{"success": True}],
                    },
                },
                {
                    "status": 200,
                    "message": "success",
                    "data": {
                        "task_id": "6c85c8cc-a77a-42b9-bc30-947815aa0558",
                        "state": -1,
                        "progress": 30,
                        "failed_stage": "audio",
                        "error": "TTS request timed out",
                    },
                },
            ],
        }
    )


class TaskListResponse(BaseResponse):
    """Dedicated response model for task lists."""

    data: TaskListData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "tasks": [
                        {
                            "task_id": "6c85c8cc-a77a-42b9-bc30-947815aa0558",
                            "state": 4,
                            "progress": 50,
                        }
                    ],
                    "total": 1,
                    "page": 1,
                    "page_size": 10,
                },
            }
        }
    )


class TaskDeletionResponse(BaseResponse):
    data: None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": None,
            },
        }
    )


class VideoScriptResponse(BaseResponse):
    data: VideoScriptData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "video_script": "Spring blooming flowers unfold like a picturesque landscape across nature..."
                },
            },
        }
    )


class VideoTermsResponse(BaseResponse):
    data: VideoTermsData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {"video_terms": ["sky", "tree"]},
            },
        }
    )


class VideoSocialMetadataResponse(BaseResponse):
    data: VideoSocialMetadataData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "title": "A Day in Shanghai You Should Not Miss",
                    "caption": "Save this quick Shanghai inspiration and follow for more short travel ideas.",
                    "hashtags": ["#shorts", "#travel", "#shanghai", "#viral", "#fyp"],
                },
            },
        }
    )


class BgmRetrieveResponse(BaseResponse):
    data: BgmRetrieveData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "files": [
                        {
                            "name": "4fca18fce7344f3aa824777a40d45c8c.mp3",
                            "size": 1891269,
                            "file": "4fca18fce7344f3aa824777a40d45c8c.mp3",
                        }
                    ]
                },
            },
        }
    )


class BgmUploadResponse(BaseResponse):
    data: BgmUploadData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {"file": "4fca18fce7344f3aa824777a40d45c8c.mp3"},
            },
        }
    )


class VideoMaterialRetrieveResponse(BaseResponse):
    data: VideoMaterialRetrieveData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "files": [
                        {
                            "name": "example.mp4",
                            "size": 12345678,
                            "file": "/Chronus/resource/videos/example.mp4",
                        }
                    ]
                },
            },
        }
    )


class VideoMaterialUploadResponse(BaseResponse):
    data: VideoMaterialUploadData

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": 200,
                "message": "success",
                "data": {
                    "file": "/Chronus/resource/videos/example.mp4",
                },
            },
        }
    )
