PUNCTUATIONS = [
    "?",
    ",",
    ".",
    "、",
    ";",
    ":",
    "!",
    "…",
    "？",
    "，",
    "。",
    "、",
    "；",
    "：",
    "！",
    "...",
    # Arabic punctuation marks serve as natural sentence breaks,
    # ensuring consistent subtitle pauses between script text and TTS.
    "،",
    "؛",
    "؟",
]

TASK_STATE_FAILED = -1
TASK_STATE_DRAFT = 0
TASK_STATE_COMPLETE = 1
TASK_STATE_PROCESSING = 4

CROSS_POST_STATE_PENDING = "pending"
CROSS_POST_STATE_PROCESSING = "processing"
CROSS_POST_STATE_COMPLETE = "complete"
CROSS_POST_STATE_FAILED = "failed"

FILE_TYPE_VIDEOS = ["mp4", "mov", "mkv", "webm"]
FILE_TYPE_IMAGES = ["jpg", "jpeg", "png", "bmp"]
