import os
import threading

from loguru import logger


PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
)
LOG_RECORD_FORMAT = (
    "<green>{time:%Y-%m-%d %H:%M:%S}</> | "
    "<level>{level}</> | "
    '"{file.path}:{line}":<blue> {function}</> '
    "- <level>{message}</>\n"
)
# Loguru's default terminal handler has ID 0 at startup.
_terminal_handler_id: int | None = 0
_terminal_handler_lock = threading.RLock()


def format_log_record(record):
    """
    Format terminal and WebUI logs uniformly with relative file paths.
    """
    file_path = record["file"].path
    if os.path.isabs(file_path):
        relative_path = os.path.relpath(file_path, PROJECT_ROOT)
        record["file"].path = f"./{relative_path}"

    # Shorten absolute project root references in log messages
    record["message"] = record["message"].replace(PROJECT_ROOT, ".")
    return LOG_RECORD_FORMAT


def configure_terminal_logger(sink, level: str, colorize: bool = True) -> int:
    """
    Safely replace process-level terminal log handler while preserving task-specific sinks.
    """
    global _terminal_handler_id

    with _terminal_handler_lock:
        if _terminal_handler_id is not None:
            try:
                logger.remove(_terminal_handler_id)
            except ValueError:
                pass

        _terminal_handler_id = logger.add(
            sink,
            level=level,
            format=format_log_record,
            colorize=colorize,
        )
        return _terminal_handler_id
