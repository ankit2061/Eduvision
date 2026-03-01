"""
Gemini client via OpenRouter (OpenAI-compatible API).
Handles: lesson generation, speech analysis, sign-to-text.
"""

import json
import base64
import asyncio
import httpx
import uuid
from typing import Optional
from openai import AsyncOpenAI
from loguru import logger
from app.config import get_settings
from app.utils.prompts import build_lesson_prompt, build_speech_analysis_prompt

settings = get_settings()

_client = AsyncOpenAI(
    api_key=settings.gemini_api_key,
    base_url=settings.gemini_base_url,
)

# _EXTRA_HEADERS = {
#     "HTTP-Referer": "https://eduvision.app",
#     "X-Title": "EduVision AI",
# }


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


async def evaluate_sign_language_video(video_bytes: bytes, mime_type: str, assignment_context: str) -> dict:
    """
    Uploads a video to Gemini File API, polls for active state, and evaluates the sign language context.
    Returns {"transcript": "...", "score": 85, "feedback": "..."}
    """
    api_key = settings.gemini_api_key

    async with httpx.AsyncClient() as client:
        # 1. Simple media upload
        logger.info(f"[Gemini] Uploading video for eval ({len(video_bytes)} bytes, {mime_type})")
        upload_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key={api_key}"
        upload_resp = await client.post(upload_url, headers={"Content-Type": mime_type}, content=video_bytes, timeout=60.0)
        upload_resp.raise_for_status()
        
        file_info = upload_resp.json().get("file", {})
        file_uri = file_info.get("uri")
        file_name = file_info.get("name")
        
        if not file_uri or not file_name:
            raise ValueError("Failed to get file URI from Gemini upload")
            
        logger.info(f"[Gemini] Uploaded video: name={file_name}, uri={file_uri}. Waiting for processing...")
        
        # 2. Wait for processing (Video needs to be processed to ACTIVE state)
        for attempt in range(45):
            check_resp = await client.get(f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}")
            check_data = check_resp.json()
            state = check_data.get("state")
            if state == "ACTIVE":
                logger.info(f"[Gemini] Video processing complete ({attempt} attempts)")
                break
            elif state == "FAILED":
                raise ValueError("Video processing failed inside Gemini")
            await asyncio.sleep(2.0)
        else:
            raise ValueError("Video processing timed out inside Gemini")
            
        # 3. Call generateContent with the file data and strict JSON output
        logger.info("[Gemini] Requesting evaluation...")
        generate_url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={api_key}"
        
        prompt = f"""
        You are a Sign Language expert and an empathetic teacher evaluating a Deaf student's assignment response.
        
        Assignment Context:
        {assignment_context}
        
        Task:
        1. Watch the uploaded video carefully and transcribe the sign language (Indian Sign Language or American Sign Language) into standard English text. Focus on the core meaning and concept rather than perfect grammar.
        2. Evaluate the transcript against the Assignment Context.
        3. Provide a normalized score out of 100 based on their understanding of the concept.
        4. Provide encouraging, supportive feedback.
        
        Respond strictly in JSON format matching this structure:
        {{"transcript": "The student signed that...", "score": 85, "feedback": "Great job..."}}
        """
        
        payload = {
            "contents": [{
                "parts": [
                    {"fileData": {"fileUri": file_uri, "mimeType": mime_type}},
                    {"text": prompt}
                ]
            }],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
        }
        
        gen_resp = await client.post(generate_url, json=payload, timeout=60.0)
        gen_resp.raise_for_status()
        
        # Parse output
        gen_data = gen_resp.json()
        try:
            text_response = gen_data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_response)
        except Exception as e:
            logger.error(f"[Gemini] Failed to parse video eval: {gen_data}")
            raise ValueError(f"Invalid JSON from Gemini: {e}")

async def normalize_score(disability_type: str, transcript: str, raw_score: float) -> dict:
    """
    Asks Gemini to normalize an AI score based on compounding disability factors.
    Returns: {"normalized_score": 92, "justification": "..."}
    """
    system_prompt = "You are an empathetic, inclusive special education teacher. Your goal is to review automated AI scores for Deaf/Hard of Hearing students or students with other disabilities, and normalize the score based on their specific disability profile. Be generous but fair."
    user_prompt = f"""
    Disability Profile: {disability_type}
    Student Transcript/Response: "{transcript}"
    Raw Automated Score: {raw_score}/100

    Please analyze the transcript in the context of the student's disability.
    For example, a Deaf student signing may use ASL/ISL grammar which translates to "broken" English. They should not be penalized for literal translation grammar if the core concept is understood.

    Provide a normalized score out of 100, and a concise 1-2 sentence justification for the adjustment.
    Respond strictly in JSON: {{"normalized_score": 92, "justification": "..."}}
    """
    
    response = await _client.chat.completions.create(
        model=settings.gemini_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
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
        logger.error(f"[Gemini] Normalize score parse error: {e}")
        return {"normalized_score": raw_score, "justification": "Failed to generate normalization."}
