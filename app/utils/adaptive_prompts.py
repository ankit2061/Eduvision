"""
Deeply specialized prompts for generating FROM-SCRATCH adaptive study materials
for each disability category via LangGraph.

Unlike disability_prompts.py (which rewrites existing text), these prompts
instruct the LLM to GENERATE original educational content specifically
designed for each disability profile.
"""

# ─────────────────────────────────────────────────────────────────────────────
# COMMON SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an elite special-education curriculum designer with 20 years of experience
creating materials for Divyangjan (persons with disabilities) students in Indian classrooms.

You will be given a TOPIC, GRADE, and a DESCRIPTION of what to teach.
Your job is to generate a COMPLETE study material — from scratch — optimized for a SPECIFIC
disability category. Every word, structure, and element must be intentionally designed for
that student profile.

CRITICAL: Output ONLY valid JSON. No markdown fences, no commentary outside the JSON object.
The JSON must match the schema specified in the user prompt EXACTLY."""

# ─────────────────────────────────────────────────────────────────────────────
# PER-CATEGORY PROMPTS
# ─────────────────────────────────────────────────────────────────────────────

ADHD_PROMPT = """Generate an ADHD-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

ADHD DESIGN RULES:
1. Start with a 1-sentence "HOOK" — something surprising or exciting about the topic.
2. Break ALL content into micro-chunks of 2-3 sentences MAX. Each chunk gets a bold emoji header.
3. After every 2 chunks, insert a "⚡ Quick Check" — a 1-question mini-quiz to re-engage attention.
4. Use ACTIVE voice only. Remove ALL filler words and tangential information.
5. Bold the single most important keyword in every chunk.
6. End with a "🏆 Level Complete!" summary of exactly 3 bullet points.
7. Include a "🎮 Challenge Mode" section with 2 harder extension questions.
8. Total material should be concise — no more than 600 words in the passage.

Output JSON:
{{
  "title": "<concise catchy title>",
  "hook": "<1 surprising sentence>",
  "passage": "<the full micro-chunked passage with emoji headers and bold keywords>",
  "checkpoint_questions": ["<quick check q1>", "<quick check q2>", "<quick check q3>"],
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<3 bullet point summary>",
  "challenge_questions": ["<harder q1>", "<harder q2>"],
  "questions": ["<comprehension q1>", "<comprehension q2>", "<comprehension q3>"]
}}"""

AUTISM_PROMPT = """Generate an Autism-Spectrum-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

AUTISM SPECTRUM DESIGN RULES:
1. Use EXTREMELY clear, literal, explicit language. Zero idioms, zero sarcasm, zero vague metaphors.
2. Structure with PREDICTABLE numbered headings: "1. What This Is", "2. How It Works", "3. Why It Matters", "4. Key Words to Remember", "5. Practice Questions".
3. Every new concept must be introduced with: "This means: [simple definition]."
4. Avoid sensory-overload language (no "LOUD", "BRIGHT", "EXPLOSIVE" unless educationally required).
5. Use consistent formatting — every section follows the same pattern.
6. Include a "Vocabulary Glossary" with simple definitions for every domain term used.
7. Number ALL steps in any process. Never use vague sequencing like "then", "next", "after that" without a number.
8. End with exactly 3 practice questions that have CLEAR, unambiguous correct answers.
9. Keep total passage between 400-600 words.

Output JSON:
{{
  "title": "<clear descriptive title>",
  "passage": "<the fully structured passage with numbered headings>",
  "vocabulary_glossary": [{{"term": "<word>", "definition": "<simple definition>"}}],
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<clear 2-sentence summary>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

DYSLEXIA_PROMPT = """Generate a Dyslexia-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

DYSLEXIA DESIGN RULES:
1. Use ONLY short, direct Subject-Verb-Object sentences. Maximum 12 words per sentence.
2. NEVER use passive voice. Always active.
3. When using a complex domain word, IMMEDIATELY define it in parentheses using simple words.
4. Insert a BLANK LINE between every 2-3 sentences to avoid "wall of text" anxiety.
5. Avoid words with similar visual shapes (b/d, p/q) in close proximity when possible.
6. Include phonetic pronunciation helpers for difficult words: e.g., "Photosynthesis (FOH-toh-SIN-thuh-sis)".
7. Use numbered lists instead of paragraphs whenever possible.
8. Include a "Words to Practice" section with phonetic breakdowns.
9. Keep total passage between 300-500 words.
10. Each key concept should be stated, then restated in different simple words.

Output JSON:
{{
  "title": "<simple clear title>",
  "passage": "<the dyslexia-optimized passage with spacing markers and simple sentences>",
  "phonetic_helpers": [{{"word": "<difficult word>", "phonetic": "<pronunciation>", "meaning": "<simple definition>"}}],
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence summary using simple words>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

VISUAL_PROMPT = """Generate a Visual-Impairment-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

VISUAL IMPAIRMENT DESIGN RULES:
1. This material will be READ ALOUD by a screen reader or TTS engine. Write accordingly.
2. NEVER say "see", "look at", "as shown", "the diagram shows", or any visual reference.
3. If explaining something typically shown in a diagram, DESCRIBE IT VERBALLY in full detail.
4. Spell out ALL abbreviations on first use: "DNA (Deoxyribonucleic Acid)".
5. Use semantic transitions so the listener knows structure: "Moving to the second main idea...", "To summarize what we just covered..."
6. Describe spatial relationships verbally: "The heart sits slightly left of center in the chest..."
7. Include an "Audio Guide Script" — a conversational version of the key points designed for listening.
8. All questions should be answerable without any visual aids.
9. Keep passage between 400-700 words (longer is okay for verbal description).

Output JSON:
{{
  "title": "<descriptive title>",
  "passage": "<screen-reader-optimized passage with verbal descriptions and transitions>",
  "audio_guide_script": "<conversational 200-word script covering the key points for listening>",
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence verbal summary>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

HEARING_PROMPT = """Generate a Hearing-Impairment-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

HEARING IMPAIRMENT DESIGN RULES — THIS IS CRITICAL:
1. The student CANNOT hear. ALL information must be VISUAL.
2. NEVER reference sounds, audio, listening, or auditory examples. Replace ALL sound analogies with visual or tactile ones.
   - BAD: "It sounds like thunder" → GOOD: "It feels like a powerful vibration, like a heavy truck passing by"
3. Use RICH visual imagery throughout. Describe colors, shapes, positions, movements.
4. For EVERY major concept, provide a DIAGRAM DESCRIPTION — a detailed written description of what a helpful diagram would look like.
5. Provide IMAGE SEARCH QUERIES — specific Google Image search strings a teacher could use to find supporting pictures.
6. Structure content as a VISUAL STORYBOARD: numbered panels with headers and descriptions.
7. Use tables, lists, and structured formats that are easy to scan visually.
8. Include a "Visual Summary" — key points presented as a structured visual flowchart description.
9. Keep passage between 400-600 words.
10. Include at least 3 diagram descriptions and 3 image search queries.

Output JSON:
{{
  "title": "<clear visual title>",
  "passage": "<visually-structured passage with rich imagery, zero audio references>",
  "diagram_descriptions": [
    {{"concept": "<what concept this illustrates>", "description": "<detailed description of what the diagram would show, including labels, arrows, colors>"}},
    {{"concept": "<concept2>", "description": "<diagram description2>"}},
    {{"concept": "<concept3>", "description": "<diagram description3>"}}
  ],
  "image_search_queries": ["<specific Google Image search query 1>", "<query 2>", "<query 3>"],
  "visual_summary": "<3-5 bullet visual flowchart description of the topic>",
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence summary>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

INTELLECTUAL_PROMPT = """Generate an Intellectual-Disability-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

INTELLECTUAL DISABILITY DESIGN RULES:
1. Use ONLY high-frequency everyday words. If you MUST use a domain term, immediately explain it like you're talking to a friend.
2. Focus on ONLY 1-2 main takeaways. Cut everything else. Less is more.
3. Use a warm, friendly, encouraging tone throughout. The student should feel safe.
4. After every key point, add a gentle rhetorical question: "Can you imagine that?" or "Isn't that interesting?"
5. Use concrete, real-world examples the student can relate to (food, family, animals, daily life).
6. Include a "Simple Summary" — the entire lesson in exactly 3 easy sentences.
7. Questions should be simple recall with clear right answers. No trick questions.
8. Total passage should be SHORT — 200-350 words maximum.
9. Use repetition strategically — state the main idea at least 3 times in different words.

Output JSON:
{{
  "title": "<friendly simple title>",
  "passage": "<warm, simple passage with everyday examples and gentle questions>",
  "simplified_summary": "<the entire lesson in 3 easy sentences>",
  "key_concepts": ["<concept1>", "<concept2>"],
  "summary": "<1-sentence summary using the simplest words possible>",
  "questions": ["<simple q1>", "<simple q2>", "<simple q3>"]
}}"""

SPEECH_PROMPT = """Generate a Speech/Stammering-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

SPEECH & STAMMERING DESIGN RULES:
1. The student may be asked to READ THIS ALOUD. Design sentence rhythm for smooth reading.
2. Keep sentences SHORT (8-12 words). Allow natural breathing pauses.
3. Avoid clusters of hard consonants (st, str, sp, sk, cr, br, pr, tr) at the start of sentences when possible.
4. Use flowing, rhythmic sentence construction. Read it aloud in your head — it should feel like a gentle stream.
5. Include a "Read-Aloud Script" version that adds breathing markers: [pause] between sentences.
6. Avoid tongue-twisters and alliterations entirely.
7. Use commas generously to create natural pause points.
8. Mark which words to emphasize with *asterisks* for the student's confidence.
9. Keep passage between 300-500 words.

Output JSON:
{{
  "title": "<smooth flowing title>",
  "passage": "<rhythmic passage designed for comfortable reading aloud>",
  "read_aloud_script": "<same passage with [pause] markers and *emphasis* markers>",
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence summary with short words>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

MOTOR_PROMPT = """Generate a Motor/Physical-Disability-optimized study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

MOTOR & PHYSICAL DISABILITY DESIGN RULES:
1. NEVER reference physical actions the student might not easily do.
   - BAD: "Take your pen and draw a map" → GOOD: "Imagine a map in your mind"
   - BAD: "Stand up and stretch" → GOOD: "Take a mental break and think about..."
2. Focus on COGNITIVE exploration — thinking, imagining, reasoning, discussing.
3. Content length is fine (400-600 words), but ensure it's engaging for a student who interacts primarily through adaptive technology.
4. Use descriptive, immersive narrative so the student feels transported into the subject.
5. Questions should be answerable by typing/clicking/selecting — never drawing or physical activity.
6. Include "Think About It" reflection prompts instead of hands-on activities.

Output JSON:
{{
  "title": "<engaging title>",
  "passage": "<cognitively engaging passage with no physical action references>",
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence summary>",
  "think_prompts": ["<reflection prompt 1>", "<reflection prompt 2>"],
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""

GENERAL_PROMPT = """Generate a General Inclusive study material for:
Topic: {topic} | Grade: {grade}

Teacher's Description:
\"\"\"{description}\"\"\"

GENERAL INCLUSIVE DESIGN RULES:
1. Use clear, readable formatting with headings and bullet points.
2. Active voice, engaging and supportive tone.
3. Include a mix of difficulty levels within the material.
4. Provide a brief summary at the end.
5. Use inclusive, culturally neutral language.
6. Keep passage between 400-600 words.

Output JSON:
{{
  "title": "<clear title>",
  "passage": "<well-structured inclusive passage>",
  "key_concepts": ["<concept1>", "<concept2>", "<concept3>"],
  "summary": "<2-sentence summary>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}}"""


# ─────────────────────────────────────────────────────────────────────────────
# CATEGORY → PROMPT MAPPING
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_PROMPTS = {
    "adhd": ADHD_PROMPT,
    "autism": AUTISM_PROMPT,
    "dyslexia": DYSLEXIA_PROMPT,
    "visual": VISUAL_PROMPT,
    "hearing": HEARING_PROMPT,
    "intellectual": INTELLECTUAL_PROMPT,
    "speech": SPEECH_PROMPT,
    "motor": MOTOR_PROMPT,
    "general": GENERAL_PROMPT,
}

ALL_CATEGORIES = list(CATEGORY_PROMPTS.keys())


def build_generation_prompt(category: str, topic: str, grade: str, description: str) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for a specific disability category."""
    template = CATEGORY_PROMPTS.get(category.lower(), GENERAL_PROMPT)
    user_prompt = template.format(topic=topic, grade=grade, description=description)
    return SYSTEM_PROMPT, user_prompt
