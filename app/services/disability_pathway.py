"""
LangGraph workflow for adapting existing lesson content dynamically based on a student's disability profile.
"""

import json
from typing import TypedDict, Optional, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.config import get_settings
from app.utils import disability_prompts
from loguru import logger

settings = get_settings()

# ─── State Definition ───

class AdaptationState(TypedDict):
    base_text: str
    disability_type: str
    learning_style: str
    adapted_passage: Optional[str]
    error: Optional[str]

# ─── Nodes ───────────────────────────────────────────────────────────────────

def get_model():
    return ChatOpenAI(
        model=settings.gemini_model,
        openai_api_key=settings.gemini_api_key,
        openai_api_base=settings.gemini_base_url,
        temperature=0.7, # A bit of creativity helps with adaptations
    )

def _parse_json(raw: str) -> Dict[str, Any]:
    """Strips markdown fences and parses JSON."""
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"[LangGraph Accommodation] JSON Parse Error: {raw[:200]}...")
        return {}

async def execute_adaptation_node(state: AdaptationState) -> Dict[str, Any]:
    """Generic node executor that uses the state to build the correct prompt."""
    logger.info(f"[LangGraph Accommodation] Node Executing | Disability: {state['disability_type']} | Style: {state['learning_style']}")
    sys, usr = disability_prompts.build_adaptation_prompt(
        base_text=state["base_text"],
        disability_type=state["disability_type"],
        learning_style=state["learning_style"]
    )
    model = get_model()
    try:
        response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
        content = _parse_json(response.content)
        adapted_passage = content.get("adapted_passage")
        
        if not adapted_passage:
             return {"error": "LLM returned empty adapted passage", "adapted_passage": state["base_text"]}

        return {"adapted_passage": adapted_passage}
    except Exception as e:
        logger.error(f"[LangGraph Accommodation] LLM error: {e}")
        return {"error": str(e), "adapted_passage": state["base_text"]}


# Define specific nodes for monitoring/routing clarity, even though they share the executor
async def adhd_node(state: AdaptationState): return await execute_adaptation_node(state)
async def autism_node(state: AdaptationState): return await execute_adaptation_node(state)
async def dyslexia_node(state: AdaptationState): return await execute_adaptation_node(state)
async def visual_node(state: AdaptationState): return await execute_adaptation_node(state)
async def hearing_node(state: AdaptationState): return await execute_adaptation_node(state)
async def intellectual_node(state: AdaptationState): return await execute_adaptation_node(state)
async def speech_node(state: AdaptationState): return await execute_adaptation_node(state)
async def motor_node(state: AdaptationState): return await execute_adaptation_node(state)
async def general_node(state: AdaptationState): return await execute_adaptation_node(state)


# ─── Routing ─────────────────────────────────────────────────────────────────

def route_by_disability(state: AdaptationState) -> str:
    dt = (state.get("disability_type") or "none").lower()
    
    if dt == "adhd": return "adhd_node"
    if dt == "autism": return "autism_node"
    if dt == "dyslexia": return "dyslexia_node"
    if dt == "visual": return "visual_node"
    if dt == "hearing": return "hearing_node"
    if dt == "intellectual": return "intellectual_node"
    if dt in ("speech", "stammering"): return "speech_node"
    if dt == "motor": return "motor_node"
    
    return "general_node"

# ─── Graph Construction ─────────────────────────────────────────────────────

workflow = StateGraph(AdaptationState)

workflow.add_node("adhd_node", adhd_node)
workflow.add_node("autism_node", autism_node)
workflow.add_node("dyslexia_node", dyslexia_node)
workflow.add_node("visual_node", visual_node)
workflow.add_node("hearing_node", hearing_node)
workflow.add_node("intellectual_node", intellectual_node)
workflow.add_node("speech_node", speech_node)
workflow.add_node("motor_node", motor_node)
workflow.add_node("general_node", general_node)

workflow.set_conditional_entry_point(
    route_by_disability,
    {
        "adhd_node": "adhd_node",
        "autism_node": "autism_node",
        "dyslexia_node": "dyslexia_node",
        "visual_node": "visual_node",
        "hearing_node": "hearing_node",
        "intellectual_node": "intellectual_node",
        "speech_node": "speech_node",
        "motor_node": "motor_node",
        "general_node": "general_node"
    }
)

for node_name in ["adhd_node", "autism_node", "dyslexia_node", "visual_node", "hearing_node", "intellectual_node", "speech_node", "motor_node", "general_node"]:
    workflow.add_edge(node_name, END)

app = workflow.compile()

# ─── Helper ──────────────────────────────────────────────────────────────────

async def adapt_content_for_student(
    base_text: str,
    disability_type: str,
    learning_style: str
) -> str:
    """Public entry point for the LangGraph accommodation workflow."""
    if not disability_type or disability_type.lower() == "none":
        # No accommodation needed, return as is (maybe check learning style, but usually general node handles it)
        if not learning_style or learning_style.lower() == "none":
             return base_text
             
    initial_state = {
        "base_text": base_text,
        "disability_type": disability_type,
        "learning_style": learning_style,
        "adapted_passage": None,
        "error": None
    }
    
    result = await app.ainvoke(initial_state)
    
    # If LLM failed, fallback to original text
    if not result.get("adapted_passage") or result.get("error"):
        logger.warning(f"Adaptation fallback triggered. Error: {result.get('error')}")
        return base_text
        
    return result["adapted_passage"]
