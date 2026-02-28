import httpx
from loguru import logger
from app.config import get_settings

settings = get_settings()

API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"

async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribes audio using Hugging Face's Inference API (Whisper model).
    """
    if not settings.hf_token:
        raise ValueError("HF_TOKEN is not set in the environment.")
        
    headers = {
        "Authorization": f"Bearer {settings.hf_token}"
    }
    
    logger.info(f"[HuggingFace] Transcribing audio ({len(audio_bytes)} bytes)")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(API_URL, headers=headers, content=audio_bytes)
        
    if response.status_code != 200:
        logger.error(f"[HuggingFace] Error {response.status_code}: {response.text}")
        raise Exception(f"HuggingFace API error: {response.status_code} - {response.text}")
        
    result = response.json()
    transcript = result.get("text", "")
    
    logger.info(f"[HuggingFace] Transcript: {transcript[:100]}...")
    return transcript.strip()
