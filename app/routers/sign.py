"""
Sign language + AAC router.
/sign/vocab-assets  — vocab → ISL/ASL sign GIF URLs
/sign/to-text       — (stretch) frames → Gemini sign translation
/aac/speak          — text/phrase → ElevenLabs classroom audio
"""

import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from loguru import logger

from app.dependencies import get_current_user
from app.models.schemas import (
    CurrentUser,
    VocabAssetsRequest,
    VocabAssetsResponse,
    VocabAsset,
    SignToTextRequest,
    SignToTextResponse,
    AacSpeakRequest,
)
from app.services import gemini, elevenlabs

router = APIRouter(tags=["Sign Language & AAC"])

# ─── Static sign asset dataset ───────────────────────────────────────────────
# Located at app/data/sign_assets.json — format:
# { "hello": {"isl_url": "...", "asl_url": "...", "caption": "Greeting"}, ... }
_ASSETS_PATH = Path(__file__).parent.parent / "data" / "sign_assets.json"

def _load_sign_data() -> dict:
    if _ASSETS_PATH.exists():
        with open(_ASSETS_PATH) as f:
            return json.load(f)
    return {}


@router.post("/sign/vocab-assets", response_model=VocabAssetsResponse)
async def vocab_assets(
    req: VocabAssetsRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Return ISL/ASL sign asset URLs for a list of vocabulary words."""
    sign_data = _load_sign_data()
    assets = []
    for word in req.words:
        entry = sign_data.get(word.lower(), {})
        assets.append(VocabAsset(
            word=word,
            sign_url=entry.get("isl_url") or entry.get("asl_url"),
            caption=entry.get("caption", word),
            language="ISL" if entry.get("isl_url") else "ASL",
        ))
    return VocabAssetsResponse(assets=assets)


@router.post("/sign/to-text", response_model=SignToTextResponse)
async def sign_to_text(
    req: SignToTextRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """
    STRETCH: Accepts base64 JPEG frames from a short sign clip.
    Attempts Gemini multimodal translation.
    """
    if not req.frames_b64:
        raise HTTPException(status_code=400, detail="At least one frame required")

    try:
        result = await gemini.translate_sign(req.frames_b64)
        return SignToTextResponse(
            text=result.get("text"),
            confidence=result.get("confidence", "low"),
            note=result.get("note", "Experimental — validate in production context"),
        )
    except Exception as e:
        logger.error(f"[Sign] Translation error: {e}")
        raise HTTPException(status_code=502, detail=f"Sign translation failed: {e}")


@router.post("/aac/speak")
async def aac_speak(
    req: AacSpeakRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """
    AAC (Augmentative and Alternative Communication) endpoint.
    Converts text/phrase to ElevenLabs audio for classroom output.
    Returns MP3 bytes directly.
    """
    try:
        audio_bytes = await elevenlabs.aac_speak(req.text, req.voice_id)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"[AAC] Speak error: {e}")
        raise HTTPException(status_code=502, detail=f"AAC speak failed: {e}")
