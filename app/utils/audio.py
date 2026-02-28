import io
import mimetypes
import tempfile
from pathlib import Path


SUPPORTED_AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
}


def detect_mime_type(filename: str, data: bytes) -> str:
    """Detect MIME type from filename extension, fallback to audio/mpeg."""
    mt, _ = mimetypes.guess_type(filename)
    if mt in SUPPORTED_AUDIO_TYPES:
        return mt
    # Sniff by magic bytes
    if data[:3] == b"ID3" or data[:2] == b"\xff\xfb":
        return "audio/mpeg"
    if data[:4] == b"RIFF":
        return "audio/wav"
    if data[:4] == b"OggS":
        return "audio/ogg"
    return "audio/mpeg"


def save_temp_audio(data: bytes, suffix: str = ".wav") -> str:
    """Save audio bytes to a temp file and return its path."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name


def audio_to_base64(path: str) -> str:
    """Read an audio file and return base64-encoded string."""
    import base64
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")
