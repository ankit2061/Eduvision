"""
ElevenLabs TTS client.
Handles: lesson audio generation, spoken feedback, AAC output.
"""

import httpx
from loguru import logger
from app.config import get_settings

settings = get_settings()

_BASE_URL = "https://api.elevenlabs.io/v1"
_HEADERS = {
    "xi-api-key": settings.elevenlabs_api_key,
    "Content-Type": "application/json",
    "Accept": "audio/mpeg",
}

_DEFAULT_VOICE_SETTINGS = {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.0,
    "use_speaker_boost": True,
}

_CALM_VOICE_SETTINGS = {  # Used for neurodivergent / AAC
    "stability": 0.75,
    "similarity_boost": 0.65,
    "style": 0.0,
    "use_speaker_boost": False,
}


async def _tts_request(
    text: str,
    voice_id: str,
    voice_settings: dict,
    model_id: str = "eleven_multilingual_v2",
) -> bytes:
    """Core TTS request to ElevenLabs, returns raw MP3 bytes."""
    url = f"{_BASE_URL}/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": voice_settings,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=_HEADERS)
        if resp.status_code != 200:
            logger.error(f"[ElevenLabs] TTS error {resp.status_code}: {resp.text[:200]}")
            resp.raise_for_status()
        return resp.content


async def tts(
    text: str,
    voice_id: str | None = None,
    stability: float = 0.5,
    similarity_boost: float = 0.75,
) -> bytes:
    """Generate TTS audio for a lesson passage. Returns MP3 bytes."""
    vid = voice_id or settings.elevenlabs_default_voice_id
    settings_override = {**_DEFAULT_VOICE_SETTINGS, "stability": stability, "similarity_boost": similarity_boost}
    logger.info(f"[ElevenLabs] TTS: voice={vid}, text_len={len(text)}")
    return await _tts_request(text, vid, settings_override)


async def spoken_feedback(
    feedback_text: str,
    voice_id: str | None = None,
    neurodivergent: bool = False,
) -> bytes:
    """Generate spoken coaching feedback. Uses calmer settings for neurodivergent users."""
    vid = voice_id or settings.elevenlabs_default_voice_id
    vs = _CALM_VOICE_SETTINGS if neurodivergent else _DEFAULT_VOICE_SETTINGS
    logger.info(f"[ElevenLabs] Spoken feedback: voice={vid}, nd={neurodivergent}")
    return await _tts_request(feedback_text, vid, vs)


async def aac_speak(text: str, voice_id: str | None = None) -> bytes:
    """Generate AAC classroom voice output. Uses a clear, calm classroom voice."""
    vid = voice_id or settings.elevenlabs_aac_voice_id
    logger.info(f"[ElevenLabs] AAC speak: voice={vid}, text={text[:60]}")
    return await _tts_request(text, vid, _CALM_VOICE_SETTINGS)


async def stt(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribes audio using ElevenLabs Speech-to-Text (Scribe API).
    """
    logger.info(f"[ElevenLabs] Transcribing audio ({len(audio_bytes)} bytes, {mime_type})")
    url = f"{_BASE_URL}/speech-to-text"
    
    # map common mime types to standard filename extensions, ElevenLabs requires a recognizable extension or valid mime
    extension = mime_type.split("/")[-1] if "/" in mime_type else "webm"
    if "webm" in mime_type:
        extension = "webm"
    elif "wav" in mime_type:
        extension = "wav"
    elif "mpeg" in mime_type or "mp3" in mime_type:
        extension = "mp3"
        
    filename = f"audio.{extension}"

    files = {
        "file": (filename, audio_bytes, mime_type)
    }
    data = {
        "model_id": "scribe_v1" # v1 is usually used as default, sometimes it is scribe_v2 but we can just omit or use scribe_v1 for testing. Or use "scribe_v1"
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        # We need another set of headers without Content-Type because httpx sets it automatically with the boundary for multipart forms
        stt_headers = {
            "xi-api-key": settings.elevenlabs_api_key,
        }
        resp = await client.post(url, headers=stt_headers, files=files, data=data)
        if resp.status_code != 200:
            logger.error(f"[ElevenLabs] STT error {resp.status_code}: {resp.text[:200]}")
            resp.raise_for_status()
        result = resp.json()
        transcript = result.get("text", "").strip()
        logger.info(f"[ElevenLabs] Transcript: {transcript[:100]}...")
        return transcript
