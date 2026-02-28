import httpx
from loguru import logger
from app.config import get_settings

settings = get_settings()

API_URL = "https://router.huggingface.co/hf-inference/models/distil-whisper/distil-large-v3"

async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribes audio using Hugging Face's Inference API (Distil-Whisper model).
    """
    if not settings.hf_token:
        raise ValueError("HF_TOKEN is not set in the environment.")
        
    headers = {
        "Authorization": f"Bearer {settings.hf_token}"
    }
    
    logger.info(f"[HuggingFace] Transcribing audio ({len(audio_bytes)} bytes) using {API_URL}")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Some models require specific parameters or query formats, but Whisper 
        # usually just takes the audio bytes directly.
        response = await client.post(API_URL, headers=headers, content=audio_bytes)
        
    if response.status_code != 200:
        # Log the first 200 chars of the error to avoid cluttering logs if it's HTML
        error_snippet = response.text[:200].replace("\n", " ")
        logger.error(f"[HuggingFace] Error {response.status_code}: {error_snippet}")
        
        if "is currently loading" in response.text:
             raise Exception("HuggingFace model is still loading. Please try again in 30 seconds.")
             
        raise Exception(f"HuggingFace API error: {response.status_code}. The model might be temporarily unavailable or requires a different format.")
        
    try:
        result = response.json()
    except Exception as e:
        logger.error(f"[HuggingFace] Failed to parse JSON response: {response.text[:200]}")
        raise Exception("HuggingFace returned an invalid JSON response.")

    transcript = result.get("text", "")
    
    logger.info(f"[HuggingFace] Transcript: {transcript[:100]}...")
    return transcript.strip()
