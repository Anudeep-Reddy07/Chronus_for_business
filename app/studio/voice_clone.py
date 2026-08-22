"""Voice cloning: create a cloned voice and expose it as a usable voice."""
import requests
from pathlib import Path
from loguru import logger

from app.config import config


def create_cloned_voice(name: str, audio_samples: list[str], provider="elevenlabs") -> str:
    """Create a cloned voice and return a usable voice_name string.
    Returns e.g. 'cloned:elevenlabs:<voice_id>' which voice.tts() understands."""
    if provider == "elevenlabs":
        return _elevenlabs_clone(name, audio_samples)
    raise ValueError(f"unsupported clone provider: {provider}")


def _elevenlabs_clone(name: str, audio_samples: list[str]) -> str:
    api_key = str(config.elevenlabs.get("api_key", "") or "").strip()
    if not api_key:
        raise RuntimeError("ElevenLabs API key is not configured")

    files = []
    for path in audio_samples:
        files.append(("files", (Path(path).name, open(path, "rb"), "audio/mpeg")))

    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": api_key}
    data = {"name": name, "description": "Studio cloned voice"}

    try:
        response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
        response.raise_for_status()
        voice_id = response.json().get("voice_id", "")
        if not voice_id:
            raise RuntimeError("ElevenLabs did not return a voice_id")
        return f"cloned:elevenlabs:{voice_id}"
    finally:
        for _, file_tuple in files:
            try:
                file_tuple[1].close()
            except Exception:
                pass
