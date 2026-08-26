"""Voice cloning: create a cloned voice and expose it as a usable voice."""
import os
import requests
from pathlib import Path
from loguru import logger

from app.config import config
from app.services.voice import get_fish_audio_api_key


def create_cloned_voice(name: str, audio_samples: list[str], provider="fish_audio") -> str:
    """Create a cloned voice and return a usable voice_name string.
    Returns e.g. 'fish_audio:<model_id>:<name>' or 'cloned:elevenlabs:<voice_id>'."""
    provider_norm = (provider or "fish_audio").lower().strip()
    if provider_norm in ("fish_audio", "fish", "fishaudio"):
        return _fish_audio_clone(name, audio_samples)
    elif provider_norm in ("elevenlabs", "eleven"):
        return _elevenlabs_clone(name, audio_samples)
    
    # Default to Fish Audio
    return _fish_audio_clone(name, audio_samples)


import subprocess


def _ensure_audio_format(file_path: str) -> str:
    """Ensure audio sample is in high-compatibility MP3 or WAV format."""
    p = Path(file_path)
    if p.suffix.lower() in (".mp3", ".wav"):
        return file_path
    
    out_path = str(p.with_suffix(".mp3"))
    try:
        cmd = ["ffmpeg", "-y", "-i", file_path, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", out_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            return out_path
    except Exception as e:
        logger.warning(f"Could not transcode {file_path} to mp3: {e}")
    return file_path


def _fish_audio_clone(name: str, audio_samples: list[str]) -> str:
    """Clone a voice model using Fish Audio API."""
    api_key = get_fish_audio_api_key()
    if not api_key:
        raise RuntimeError("Fish Audio API key is not configured. Please open Settings and enter your Fish Audio API Key (get free key at https://fish.audio).")

    if not audio_samples:
        raise RuntimeError("No audio samples provided for voice cloning.")

    files = []
    opened_fps = []
    try:
        for raw_path in audio_samples:
            path = _ensure_audio_format(raw_path)
            p = Path(path)
            ext = p.suffix.lower()
            mime = "audio/wav" if ext == ".wav" else "audio/mpeg"
            fp = open(path, "rb")
            opened_fps.append(fp)
            files.append(("voices", (p.name, fp, mime)))

        url = "https://api.fish.audio/model"
        headers = {"Authorization": f"Bearer {api_key}"}
        data = {
            "title": name,
            "type": "tts",
            "visibility": "private",
            "train_mode": "fast",
        }

        logger.info(f"Submitting voice cloning request to Fish Audio for '{name}' with {len(files)} sample(s)...")
        response = requests.post(url, headers=headers, data=data, files=files, timeout=120)
        
        if not response.ok:
            try:
                err_json = response.json()
                err_msg = err_json.get("message") or err_json.get("error") or response.text[:200]
            except Exception:
                err_msg = response.text[:200]
            raise RuntimeError(f"Fish Audio API error ({response.status_code}): {err_msg}")

        resp_data = response.json()
        model_id = resp_data.get("_id") or resp_data.get("id") or ""
        if not model_id:
            raise RuntimeError(f"Fish Audio did not return a model ID: {response.text[:200]}")

        logger.success(f"Fish Audio voice cloned successfully! Model ID: {model_id}")
        return f"fish_audio:{model_id}:{name}"
    finally:
        for fp in opened_fps:
            try:
                fp.close()
            except Exception:
                pass


def _elevenlabs_clone(name: str, audio_samples: list[str]) -> str:
    api_key = str(config.elevenlabs.get("api_key", "") or "").strip()
    if not api_key:
        raise RuntimeError("ElevenLabs API key is not configured. Please configure it in Settings.")

    files = []
    opened_fps = []
    try:
        for path in audio_samples:
            fp = open(path, "rb")
            opened_fps.append(fp)
            files.append(("files", (Path(path).name, fp, "audio/mpeg")))

        url = "https://api.elevenlabs.io/v1/voices/add"
        headers = {"xi-api-key": api_key}
        data = {"name": name, "description": "Studio cloned voice"}

        response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
        response.raise_for_status()
        voice_id = response.json().get("voice_id", "")
        if not voice_id:
            raise RuntimeError("ElevenLabs did not return a voice_id")
        return f"cloned:elevenlabs:{voice_id}"
    finally:
        for fp in opened_fps:
            try:
                fp.close()
            except Exception:
                pass

