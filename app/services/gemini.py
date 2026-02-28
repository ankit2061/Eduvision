"""
Gemini client via OpenRouter (OpenAI-compatible API).
Handles: lesson generation, speech analysis, sign-to-text.
"""

import json
import base64
from typing import Optional
from openai import AsyncOpenAI
from loguru import logger
from app.config import get_settings
from app.utils.prompts import build_lesson_prompt, build_speech_analysis_prompt

settings = get_settings()

_client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
)

_EXTRA_HEADERS = {
    "HTTP-Referer": "https://eduvision.app",
    "X-Title": "EduVision AI",
}


async def generate_lesson(
    topic: str,
    grade: str,
    tiers: int,
    language: str,
    base_text: Optional[str] = None,
) -> dict:
    """
    Calls Gemini to generate a differentiated lesson with tiered passages + questions.
    Returns the parsed JSON dict with key 'tiers'.
    """
    system_prompt, user_prompt = build_lesson_prompt(topic, grade, tiers, language, base_text)

    logger.info(f"[Gemini] Generating lesson: topic={topic}, grade={grade}, tiers={tiers}")
    response = await _client.chat.completions.create(
        model=settings.gemini_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        extra_headers=_EXTRA_HEADERS,
    )
    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[Gemini] JSON parse error: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Gemini returned invalid JSON: {e}")


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """
    Sends audio to Gemini (multimodal) for transcription.
    Returns the raw transcript string.
    """
    logger.info(f"[Gemini] Transcribing audio ({len(audio_bytes)} bytes, {mime_type})")
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    response = await _client.chat.completions.create(
        model=settings.gemini_audio_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Transcribe the following audio accurately. "
                            "Output ONLY the verbatim transcript — no commentary, "
                            "no punctuation correction, preserve all hesitations (um, uh, etc.)."
                        ),
                    },
                    {
                        "type": "image_url",  # OpenRouter inline media format
                        "image_url": {
                            "url": f"data:{mime_type};base64,{audio_b64}"
                        },
                    },
                ],
            }
        ],
        temperature=0.0,
        extra_headers=_EXTRA_HEADERS,
    )
    transcript = response.choices[0].message.content.strip()
    logger.info(f"[Gemini] Transcript: {transcript[:100]}...")
    return transcript


async def analyze_speech(
    transcript: str,
    mode: str,
    stammer_friendly: bool = False,
    hearing_impaired: bool = False,
    neurodivergent: bool = False,
) -> dict:
    """
    Analyzes a speech transcript and returns scores + feedback JSON.
    Accessibility flags adjust the scoring prompt accordingly.
    """
    system_prompt, user_prompt = build_speech_analysis_prompt(
        transcript=transcript,
        mode=mode,
        stammer_friendly=stammer_friendly,
        hearing_impaired=hearing_impaired,
        neurodivergent=neurodivergent,
    )

    logger.info(f"[Gemini] Analyzing speech: mode={mode}, stammer={stammer_friendly}")
    response = await _client.chat.completions.create(
        model=settings.gemini_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        extra_headers=_EXTRA_HEADERS,
    )
    raw = response.choices[0].message.content.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[Gemini] Speech analysis JSON parse error: {e}")
        raise ValueError(f"Gemini returned invalid speech analysis JSON: {e}")


async def translate_sign(frames_b64: list[str]) -> dict:
    """
    Stretch feature: attempts to translate sign language from base64 frames.
    Sends frames as images to Gemini multimodal and returns best-guess text.
    """
    logger.info(f"[Gemini] Sign-to-text: {len(frames_b64)} frames")

    content = [
        {
            "type": "text",
            "text": (
                "These images are frames from a short sign language video (ISL or ASL). "
                "Attempt to identify the sign(s) being made and translate them to English text. "
                "Output JSON: {\"text\": \"<translation>\", \"confidence\": \"low|medium|high\", "
                "\"note\": \"<any caveats>\"}"
            ),
        }
    ]

    for frame_b64 in frames_b64[:5]:  # limit to 5 frames
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"},
        })

    response = await _client.chat.completions.create(
        model=settings.gemini_model,
        messages=[{"role": "user", "content": content}],
        temperature=0.2,
        extra_headers=_EXTRA_HEADERS,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"text": raw, "confidence": "low", "note": "Raw output — JSON parse failed"}
