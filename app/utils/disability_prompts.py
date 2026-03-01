"""
Disability-specific prompts for rewriting educational content via LangGraph.
"""

from typing import Optional

ADAPT_PASSAGE_SYSTEM = """You are an expert special education teacher and instructional designer.
Your task is to take a standard educational passage and strictly rewrite it to accommodate a specific student's neurodivergent or disability profile, and their preferred learning style.
Do NOT change the core educational facts, but deeply transform the presentation, vocabulary, structure, and formatting.
Always output strict JSON — no markdown fences, no prose outside the JSON envelope.

The output JSON must have this exact structure:
{
  "adapted_passage": "<the fully rewritten and formatted text>"
}
"""

ADAPT_PASSAGE_USER_TEMPLATE = """Adapt the following educational text.

Student's Primary Disability/Need: {disability_type}
Student's Preferred Learning Style: {learning_style}

Original Text:
\"\"\"
{base_text}
\"\"\"

Apply the following specific adaptation rules based on their profile:
{adaptation_rules}
"""

# -------------- PREDEFINED RULES --------------

RULES_ADHD = """
ADHD RULES:
- Break the text into very short, punchy paragraphs (2-3 sentences max).
- Use bullet points aggressively to convey lists or sequences.
- Bold the most critical keywords or concepts to draw the eye.
- Remove unnecessary filler words, fluff, or overly complex tangent sentences.
- Include a "TL;DR" (Too Long; Didn't Read) or "Quick Summary" sentence at the very beginning.
"""

RULES_AUTISM = """
AUTISM SPECTRUM RULES:
- Use clear, literal, and highly explicit language. Avoid idioms, sarcasm, or highly abstract metaphors.
- Emphasize predictability: Use clear headings for every section (e.g., "What This Is About", "How It Works", "Why It Matters").
- Sensory-friendly: Avoid evoking overwhelming sensory imagery (loud noises, intense textures) unless educationally necessary.
- Number steps logically if describing a process.
"""

RULES_DYSLEXIA = """
DYSLEXIA RULES:
- Use simple, direct sentence structures (Subject-Verb-Object).
- Avoid passive voice entirely.
- Keep vocabulary decodable where possible; if a complex domain word is used, define it immediately in simple terms in parentheses.
- Use wide spacing between concepts (represent with blank lines).
- Avoid 'wall of text' layouts at all costs.
"""

RULES_VISUAL = """
VISUAL IMPAIRMENT RULES:
- The text is likely going to be read by a Screen Reader (TTS). 
- Ensure absolutely descriptive language. If the original text refers to "this diagram" or "like this", you MUST replace it with a full verbal description of the concept.
- Spell out abbreviations or complex symbols on first use.
- Structure with clear, semantic-sounding transitions so the listener doesn't get lost in the audio stream.
"""

RULES_HEARING = """
HEARING IMPAIRMENT RULES:
- The student cannot rely on audio cues. 
- Ensure all information is visually structured in the text.
- If the original text mentions "listen to the sound of" or relies on auditory examples (e.g., "it sounds like a train"), replace the analogy with a visual or physical analogy (e.g., "it vibrates powerfully like a passing train").
- Use rich visual imagery.
"""

RULES_INTELLECTUAL = """
INTELLECTUAL DISABILITY RULES:
- Greatly simplify the vocabulary. Use high-frequency, everyday words.
- Reduce cognitive load: Focus ONLY on to 1 or 2 main takeaways. Cut out excessive historical dates, minor figures, or tertiary details.
- Use a friendly, encouraging tone.
- Add frequent, short rhetorical questions to keep the reader engaged (e.g., "Can you imagine that?").
"""

RULES_MOTOR = """
MOTOR / PHYSICAL DISABILITY RULES:
- Content length is fine, but avoid implying physical actions the student might not easily do (e.g., instead of "Now take your pen and draw a quick map", say "Imagine a map in your mind").
- Keep the narrative engaging and focused on cognitive exploration rather than physical manipulation.
"""

RULES_SPEECH = """
SPEECH / STAMMERING RULES:
- Since the student may be asked to read this aloud later, avoid intense clusters of difficult-to-pronounce words or complex tongue-twisters.
- Keep sentence length relatively short to allow for natural breathing pauses.
- Use rhythmic, flowing sentence construction.
"""

RULES_GENERAL = """
GENERAL INCLUSIVE RULES:
- Ensure clear, readable formatting.
- Use active voice and an engaging, supportive tone.
- Provide a brief summary at the end.
"""

def get_adaptation_rules(disability_type: str) -> str:
    """Returns the specific adaptation rules based on the disability type."""
    dt = (disability_type or "general").lower()
    
    if dt == "adhd": return RULES_ADHD
    if dt == "autism": return RULES_AUTISM
    if dt == "dyslexia": return RULES_DYSLEXIA
    if dt == "visual": return RULES_VISUAL
    if dt == "hearing": return RULES_HEARING
    if dt == "intellectual": return RULES_INTELLECTUAL
    if dt in ("speech", "stammering"): return RULES_SPEECH
    if dt == "motor": return RULES_MOTOR
    
    return RULES_GENERAL

def get_learning_style_addendum(learning_style: str) -> str:
    """Returns a short addendum for the learning style (Visual, Auditory, Kinesthetic, Reading/Writing)."""
    ls = (learning_style or "none").lower()
    
    if ls == "visual":
        return "- Emphasize visual metaphors, color mentions, and spatial relationships."
    if ls == "auditory":
        return "- Make the text conversational and rhythmic, suitable for listening."
    if ls == "kinesthetic":
        return "- Relate concepts to physical sensations, movement, and real-world actions."
    if ls == "reading_writing":
        return "- Focus on deep textual analysis, rich vocabulary, and structured note-taking cues."
        
    return ""

def build_adaptation_prompt(base_text: str, disability_type: str, learning_style: str) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt) for the adaptation model."""
    rules = get_adaptation_rules(disability_type)
    ls_addendum = get_learning_style_addendum(learning_style)
    
    combined_rules = f"{rules}\n\nADDITIONAL LEARNING STYLE RULES ({learning_style}):\n{ls_addendum}"
    
    user_prompt = ADAPT_PASSAGE_USER_TEMPLATE.format(
        disability_type=disability_type,
        learning_style=learning_style,
        base_text=base_text,
        adaptation_rules=combined_rules
    )
    
    return ADAPT_PASSAGE_SYSTEM, user_prompt
