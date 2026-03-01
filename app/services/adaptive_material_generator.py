"""
LangGraph fan-out pipeline that generates ALL 9 adaptive study material versions
in parallel from a single teacher input (topic + grade + description).

Architecture:
  Entry → [fan-out to 9 category nodes in parallel] → Collector → END

Each node calls Gemini with a category-specialized prompt and returns structured JSON.
The collector merges all results into { "adaptive_versions": { ... } }.
"""

import json
import asyncio
from typing import TypedDict, Optional, Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from app.config import get_settings
from app.utils import adaptive_prompts
from loguru import logger

settings = get_settings()


# ─── State ───────────────────────────────────────────────────────────────────

class AdaptiveGenState(TypedDict):
    topic: str
    grade: str
    description: str
    # Accumulates results from each category node
    adaptive_versions: Dict[str, Any]
    errors: Dict[str, str]


# ─── Model ───────────────────────────────────────────────────────────────────

def get_model():
    return ChatOpenAI(
        model=settings.gemini_model,
        openai_api_key=settings.gemini_api_key,
        openai_api_base=settings.gemini_base_url,
        temperature=0.7,
    )


def _parse_json(raw: str) -> Dict[str, Any]:
    """Strips markdown fences and parses JSON."""
    if "```" in raw:
        parts = raw.split("```")
        if len(parts) >= 2:
            raw = parts[1]
            if raw.startswith("json"):
                raw = raw[4:]
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"[AdaptiveGen] JSON Parse Error: {raw[:200]}...")
        return {}


# ─── Generic Category Node Factory ──────────────────────────────────────────

def make_category_node(category: str):
    """Creates a LangGraph node function for a specific disability category."""

    async def node_fn(state: AdaptiveGenState) -> Dict[str, Any]:
        logger.info(f"[AdaptiveGen] Generating for category: {category}")
        sys_prompt, usr_prompt = adaptive_prompts.build_generation_prompt(
            category=category,
            topic=state["topic"],
            grade=state["grade"],
            description=state["description"],
        )
        model = get_model()
        try:
            response = await model.ainvoke([
                SystemMessage(content=sys_prompt),
                HumanMessage(content=usr_prompt),
            ])
            content = _parse_json(response.content)
            if not content:
                return {
                    "adaptive_versions": {**state.get("adaptive_versions", {}), category: {"error": "Empty JSON"}},
                    "errors": {**state.get("errors", {}), category: "LLM returned empty JSON"},
                }
            # Tag the content with its category
            content["category"] = category
            return {
                "adaptive_versions": {**state.get("adaptive_versions", {}), category: content},
                "errors": state.get("errors", {}),
            }
        except Exception as e:
            logger.error(f"[AdaptiveGen] Error for {category}: {e}")
            return {
                "adaptive_versions": {**state.get("adaptive_versions", {}), category: {"error": str(e)}},
                "errors": {**state.get("errors", {}), category: str(e)},
            }

    node_fn.__name__ = f"{category}_gen"
    return node_fn


# ─── Collector Node ──────────────────────────────────────────────────────────

async def collector_node(state: AdaptiveGenState) -> Dict[str, Any]:
    """Final node that validates all versions were generated."""
    versions = state.get("adaptive_versions", {})
    errors = state.get("errors", {})
    success_count = sum(1 for v in versions.values() if "error" not in v)
    logger.info(f"[AdaptiveGen] Collector: {success_count}/{len(adaptive_prompts.ALL_CATEGORIES)} versions generated. Errors: {list(errors.keys())}")
    return {}


# ─── Graph Construction ─────────────────────────────────────────────────────

workflow = StateGraph(AdaptiveGenState)

# Add all category nodes
for cat in adaptive_prompts.ALL_CATEGORIES:
    workflow.add_node(f"{cat}_gen", make_category_node(cat))

workflow.add_node("collector", collector_node)

# Fan-out: entry → all category nodes
# LangGraph doesn't natively support "fan-out to all simultaneously" from entry.
# Instead, we use a dispatcher node that triggers all categories.

async def dispatcher_node(state: AdaptiveGenState) -> Dict[str, Any]:
    """Dispatcher that runs all category generators concurrently."""
    logger.info(f"[AdaptiveGen] Dispatcher: Generating {len(adaptive_prompts.ALL_CATEGORIES)} adaptive versions for '{state['topic']}'")
    
    tasks = []
    for cat in adaptive_prompts.ALL_CATEGORIES:
        node_fn = make_category_node(cat)
        tasks.append(node_fn(state))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    merged_versions = {}
    merged_errors = {}
    for cat, result in zip(adaptive_prompts.ALL_CATEGORIES, results):
        if isinstance(result, Exception):
            merged_errors[cat] = str(result)
            merged_versions[cat] = {"error": str(result), "category": cat}
        else:
            versions = result.get("adaptive_versions", {})
            errors = result.get("errors", {})
            merged_versions.update(versions)
            merged_errors.update(errors)
    
    return {"adaptive_versions": merged_versions, "errors": merged_errors}

# Simplified graph: dispatcher → collector → END
workflow_simple = StateGraph(AdaptiveGenState)
workflow_simple.add_node("dispatcher", dispatcher_node)
workflow_simple.add_node("collector", collector_node)
workflow_simple.set_entry_point("dispatcher")
workflow_simple.add_edge("dispatcher", "collector")
workflow_simple.add_edge("collector", END)

app = workflow_simple.compile()


# ─── Public API ──────────────────────────────────────────────────────────────

async def generate_all_versions(
    topic: str,
    grade: str,
    description: str,
) -> Dict[str, Any]:
    """
    Public entry point. Generates adaptive study materials for ALL disability categories.
    Returns: { "adaptive_versions": { "adhd": {...}, "hearing": {...}, ... } }
    """
    initial_state: AdaptiveGenState = {
        "topic": topic,
        "grade": grade,
        "description": description,
        "adaptive_versions": {},
        "errors": {},
    }

    result = await app.ainvoke(initial_state)

    versions = result.get("adaptive_versions", {})
    errors = result.get("errors", {})

    success_count = sum(1 for v in versions.values() if "error" not in v or v.get("passage"))
    logger.info(f"[AdaptiveGen] Complete: {success_count}/{len(adaptive_prompts.ALL_CATEGORIES)} versions. Errors: {list(errors.keys()) if errors else 'none'}")

    return {
        "adaptive_versions": versions,
        "generation_stats": {
            "total": len(adaptive_prompts.ALL_CATEGORIES),
            "success": success_count,
            "failed": list(errors.keys()),
        }
    }
