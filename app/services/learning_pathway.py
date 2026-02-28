"""
LangGraph workflow for learning style-specific content generation.
Uses Gemini (via LangChain OpenAI adapter) as the central model.
"""

import json
from typing import TypedDict, Optional, List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.config import get_settings
from app.utils import prompts
from loguru import logger

settings = get_settings()

# ─── State Definition ───

class GraphState(TypedDict):
    topic: str
    grade: str
    tiers: int
    language: str
    base_text: Optional[str]
    learning_style: str
    generated_content: Optional[Dict[str, Any]]
    iterations: int
    error: Optional[str]


# ─── Nodes ───────────────────────────────────────────────────────────────────

def get_model():
    return ChatOpenAI(
        model=settings.gemini_model,
        openai_api_key=settings.gemini_api_key,
        openai_api_base=settings.gemini_base_url,
        temperature=0.7,
    )

async def classifier_node(state: GraphState) -> Dict[str, Any]:
    """Initial node to set up context or clean inputs if needed."""
    logger.info(f"[LangGraph] Node: Classifier | Style: {state['learning_style']}")
    return {"iterations": state.get("iterations", 0) + 1}

async def visual_generator_node(state: GraphState) -> Dict[str, Any]:
    logger.info("[LangGraph] Node: Visual Generator")
    sys, usr = prompts.build_lesson_prompt(
        topic=state["topic"],
        grade=state["grade"],
        tiers=state["tiers"],
        language=state["language"],
        base_text=state["base_text"],
        learning_style="visual"
    )
    model = get_model()
    response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
    return {"generated_content": _parse_json(response.content)}

async def auditory_generator_node(state: GraphState) -> Dict[str, Any]:
    logger.info("[LangGraph] Node: Auditory Generator")
    sys, usr = prompts.build_lesson_prompt(
        topic=state["topic"],
        grade=state["grade"],
        tiers=state["tiers"],
        language=state["language"],
        base_text=state["base_text"],
        learning_style="auditory"
    )
    model = get_model()
    response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
    return {"generated_content": _parse_json(response.content)}

async def kinesthetic_generator_node(state: GraphState) -> Dict[str, Any]:
    logger.info("[LangGraph] Node: Kinesthetic Generator")
    sys, usr = prompts.build_lesson_prompt(
        topic=state["topic"],
        grade=state["grade"],
        tiers=state["tiers"],
        language=state["language"],
        base_text=state["base_text"],
        learning_style="kinesthetic"
    )
    model = get_model()
    response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
    return {"generated_content": _parse_json(response.content)}

async def reading_writing_generator_node(state: GraphState) -> Dict[str, Any]:
    logger.info("[LangGraph] Node: Reading/Writing Generator")
    sys, usr = prompts.build_lesson_prompt(
        topic=state["topic"],
        grade=state["grade"],
        tiers=state["tiers"],
        language=state["language"],
        base_text=state["base_text"],
        learning_style="reading_writing"
    )
    model = get_model()
    response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
    return {"generated_content": _parse_json(response.content)}

async def general_generator_node(state: GraphState) -> Dict[str, Any]:
    logger.info("[LangGraph] Node: General Generator")
    sys, usr = prompts.build_lesson_prompt(
        topic=state["topic"],
        grade=state["grade"],
        tiers=state["tiers"],
        language=state["language"],
        base_text=state["base_text"]
    )
    model = get_model()
    response = await model.ainvoke([SystemMessage(content=sys), HumanMessage(content=usr)])
    return {"generated_content": _parse_json(response.content)}

async def validator_node(state: GraphState) -> Dict[str, Any]:
    """Node to ensure the output JSON is valid and complete."""
    content = state.get("generated_content")
    if not content or "tiers" not in content:
        logger.warning("[LangGraph] Validation failed: missing 'tiers'")
        return {"error": "Invalid JSON structure"}
    
    logger.info("[LangGraph] Node: Validator | Success")
    return {"error": None}


# ─── Routing ─────────────────────────────────────────────────────────────────

def route_by_style(state: GraphState) -> str:
    style = state.get("learning_style", "none").lower()
    if style == "visual": return "visual_gen"
    if style == "auditory": return "auditory_gen"
    if style == "kinesthetic": return "kinesthetic_gen"
    if style == "reading_writing": return "reading_gen"
    return "general_gen"


# ─── Graph Construction ─────────────────────────────────────────────────────

workflow = StateGraph(GraphState)

workflow.add_node("classifier", classifier_node)
workflow.add_node("visual_gen", visual_generator_node)
workflow.add_node("auditory_gen", auditory_generator_node)
workflow.add_node("kinesthetic_gen", kinesthetic_generator_node)
workflow.add_node("reading_gen", reading_writing_generator_node)
workflow.add_node("general_gen", general_generator_node)
workflow.add_node("validator", validator_node)

workflow.set_entry_point("classifier")

workflow.add_conditional_edges(
    "classifier",
    route_by_style,
    {
        "visual_gen": "visual_gen",
        "auditory_gen": "auditory_gen",
        "kinesthetic_gen": "kinesthetic_gen",
        "reading_gen": "reading_gen",
        "general_gen": "general_gen"
    }
)

for gen_node in ["visual_gen", "auditory_gen", "kinesthetic_gen", "reading_gen", "general_gen"]:
    workflow.add_edge(gen_node, "validator")

workflow.add_edge("validator", END)

app = workflow.compile()


# ─── Helper ──────────────────────────────────────────────────────────────────

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
        logger.error(f"[LangGraph] JSON Parse Error: {raw[:200]}...")
        return {}


async def generate_styled_lesson(
    topic: str,
    grade: str,
    tiers: int,
    language: str,
    learning_style: str = "none",
    base_text: Optional[str] = None
) -> Dict[str, Any]:
    """Public entry point for the LangGraph workflow."""
    initial_state = {
        "topic": topic,
        "grade": grade,
        "tiers": tiers,
        "language": language,
        "base_text": base_text,
        "learning_style": learning_style,
        "generated_content": None,
        "iterations": 0,
        "error": None
    }
    
    result = await app.ainvoke(initial_state)
    if result.get("error"):
        raise ValueError(f"LangGraph generation failed: {result['error']}")
    
    return result["generated_content"]
