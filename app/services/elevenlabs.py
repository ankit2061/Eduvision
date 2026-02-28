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
