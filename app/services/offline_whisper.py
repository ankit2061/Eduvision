import whisper
import tempfile
import os
from loguru import logger
from functools import lru_cache

# Load model once and cache it
@lru_cache()
def get_model():
    logger.info("[Whisper] Loading 'base' model (this may take a moment on first run)...")
    return whisper.load_model("base")

import asyncio

async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribes audio using a local OpenAI Whisper model.
    """
    model = get_model()
    
    # Whisper requires a file path, so we use a temp file
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
        
    try:
        logger.info(f"[Whisper] Transcribing {len(audio_bytes)} bytes from {tmp_path}")
        # Run transcription in a separate thread to avoid blocking the event loop
        result = await asyncio.to_thread(model.transcribe, tmp_path)
        transcript = result.get("text", "").strip()
        logger.info(f"[Whisper] Transcript: {transcript[:100]}...")
        return transcript
    except Exception as e:
        logger.error(f"[Whisper] Transcription failed: {e}")
        raise e
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
