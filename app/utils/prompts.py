from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# LESSON GENERATION PROMPT
# ─────────────────────────────────────────────────────────────────────────────

LESSON_GEN_SYSTEM = """You are an expert curriculum designer specializing in differentiated instruction.
Your task is to generate reading passages and comprehension questions at multiple difficulty tiers for K-12 students.
Always output strict JSON — no markdown, no prose outside the JSON envelope."""

LESSON_GEN_USER_TEMPLATE = """Generate a differentiated reading lesson with the following parameters:
- Topic: {topic}
- Grade Level: {grade}
- Number of Tiers: {tiers}
- Language: {language}
{base_text_section}

Output JSON with this exact structure:
{{
  "tiers": [
    {{
      "level": 1,
      "label": "Foundational",
      "passage": "<100-150 word passage, very simple vocabulary>",
      "questions": ["Q1", "Q2", "Q3"]
    }},
    {{
      "level": 2,
      "label": "Grade-Level",
      "passage": "<200-250 word passage, grade-appropriate>",
      "questions": ["Q1", "Q2", "Q3", "Q4"]
    }},
    {{
      "level": 3,
      "label": "Advanced",
      "passage": "<300-350 word passage, enriched vocabulary and analysis>",
      "questions": ["Q1", "Q2", "Q3", "Q4", "Q5"]
    }}
  ]
}}

Rules:
- Tiers should escalate in vocabulary complexity, passage length, and question depth.
- Questions at Tier 1: recall only. Tier 2: recall + inference. Tier 3: analysis + synthesis.
- If fewer than 3 tiers requested, omit higher tiers.
- Use inclusive, culturally neutral language.
- Output ONLY the JSON object. No additional text."""

BASE_TEXT_TEMPLATE = "- Base Text to adapt: ```{base_text}```"


# ─────────────────────────────────────────────────────────────────────────────
# SPEECH ANALYSIS PROMPTS
# ─────────────────────────────────────────────────────────────────────────────

SPEECH_ANALYSIS_SYSTEM = """You are an expert English language coach providing structured feedback to students.
Always output strict JSON. Be encouraging and constructive — never use harsh or discouraging language."""

SPEECH_ANALYSIS_USER_TEMPLATE = """Analyze the following student speech transcript and provide detailed feedback.

Mode: {mode}
Transcript:
\"\"\"
{transcript}
\"\"\"

{accessibility_addendum}

Score the student on a scale of 0-10 for each dimension, and identify specific word/phrase-level issues.

Output JSON with this exact structure:
{{
  "scores": {{
    "fluency": <0-10>,
    "grammar": <0-10>,
    "confidence": <0-10>,
    "pronunciation": <0-10>
  }},
  "feedback_text": "<2-3 sentences of supportive, actionable feedback>",
  "word_marks": [
    {{"word": "<word>", "issue": "<mispronounced|grammar|hesitation>", "suggestion": "<correction>"}}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "next_steps": ["<step 1>", "<step 2>"]
}}

Rules:
- feedback_text must be warm, supportive, and end on a positive note.
- word_marks should identify at most 5 issues — focus on the most impactful ones.
- If transcript is empty or inaudible, set all scores to 0 and feedback_text to an encouraging retry message."""

STAMMER_FRIENDLY_ADDENDUM = """
IMPORTANT — STAMMER-FRIENDLY MODE IS ACTIVE:
- Do NOT penalize repetitions, prolongations, or blocks in the fluency score.
- Do NOT mark hesitations (um, uh, repeated words) as issues in word_marks.
- Score fluency based on overall intelligibility and content clarity ONLY.
- In feedback_text, do NOT mention stuttering, stammering, or hesitations.
- Focus exclusively on grammar and vocabulary strengths."""

HEARING_IMPAIRED_ADDENDUM = """
ACCESSIBILITY NOTE — HEARING IMPAIRED MODE:
- Ensure feedback_text is detailed and visual (suitable for reading, not hearing).
- Provide an extra-detailed word_marks list with precise suggestions.
- Include a rubric-style breakdown within feedback_text."""

NEURODIVERGENT_ADDENDUM = """
ACCESSIBILITY NOTE — NEURODIVERGENT-FRIENDLY MODE:
- Keep feedback_text very short (max 2 sentences), positive, and direct.
- Use simple, concrete language — avoid abstract phrases.
- next_steps must be a single, concrete action item, not a list of improvements.
- Do NOT use any negative framing. Replace "You need to improve X" with "Try practising X".
- Celebrate effort explicitly in feedback_text."""


def build_lesson_prompt(
    topic: str,
    grade: str,
    tiers: int,
    language: str,
    base_text: Optional[str] = None,
) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for lesson generation."""
    base_text_section = (
        BASE_TEXT_TEMPLATE.format(base_text=base_text) if base_text else ""
    )
    user_prompt = LESSON_GEN_USER_TEMPLATE.format(
        topic=topic,
        grade=grade,
        tiers=tiers,
        language=language,
        base_text_section=base_text_section,
    )
    return LESSON_GEN_SYSTEM, user_prompt


def build_speech_analysis_prompt(
    transcript: str,
    mode: str,
    stammer_friendly: bool = False,
    hearing_impaired: bool = False,
    neurodivergent: bool = False,
) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for speech analysis."""
    addendums = []
    if stammer_friendly:
        addendums.append(STAMMER_FRIENDLY_ADDENDUM)
    if hearing_impaired:
        addendums.append(HEARING_IMPAIRED_ADDENDUM)
    if neurodivergent:
        addendums.append(NEURODIVERGENT_ADDENDUM)

    accessibility_addendum = "\n".join(addendums)

    user_prompt = SPEECH_ANALYSIS_USER_TEMPLATE.format(
        mode=mode,
        transcript=transcript,
        accessibility_addendum=accessibility_addendum,
    )
    return SPEECH_ANALYSIS_SYSTEM, user_prompt
