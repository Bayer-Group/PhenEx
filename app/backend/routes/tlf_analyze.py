"""
TLF Analysis endpoint — AI agent with tools to explore and analyze all
study execution outputs: tables, listings, figures, logs, and metadata.
The agent can autonomously find and read files based on user questions.
"""

import asyncio
import io
import json
import logging
import os
from pathlib import Path
from typing import List
from dataclasses import dataclass

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils import storage as _storage
from .tlf_import import _describe_file

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Request model ─────────────────────────────────────────────────────────────

class TLFAnalyzeRequest(BaseModel):
    execution_id: str
    user_instructions: str = ""
    conversation: List[dict] = []   # prior {role, content} turns for follow-ups
    force_refresh: bool = False     # if True, ignore cache and re-run agent


# ── Agent Context ─────────────────────────────────────────────────────────────

@dataclass
class TLFContext:
    """Context passed to agent tools."""
    study_id: str
    execution_id: str
    artifacts_dir: str
    manifest: dict
    message_queue: asyncio.Queue  # for streaming tool feedback


# ── Create Agent ─────────────────────────────────────────────────────────────

# Initialize Azure OpenAI client (same pattern as copilot.py — must be ASYNC)
import httpx
from openai import AsyncAzureOpenAI
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

_http_client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0), verify=False)
azure_client = AsyncAzureOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("OPENAI_API_VERSION", "2025-01-01-preview"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    http_client=_http_client,
)

azure_model = OpenAIChatModel(
    "gpt-4o",
    provider=OpenAIProvider(openai_client=azure_client),
)

agent = Agent(
    azure_model,
    system_prompt="""
You are an expert clinical biostatistician analyzing study execution outputs.

Your role is to provide instant, structured insights from Tables, Listings, and Figures (TLFs).

🎯 **TWO MODES:**

**MODE 1: AUTO-ANALYSIS (Initial page load)**
When the user first opens the study, you autonomously:
1. List all files to understand what's available
2. Identify and read key files:
   - Patient counts / disposition
   - Demographics / baseline characteristics  
   - Primary outcomes / efficacy results
   - Adverse events / safety
3. Extract structured metrics and generate an executive summary
4. Flag any data quality issues

You respond with structured JSON cards that populate the dashboard.

**MODE 2: INTERACTIVE CHAT**
After auto-analysis, users ask follow-up questions. You:
- Use your tools to explore files and answer questions
- Reference the dashboard: "Looking at the demographics you saw earlier..."
- Provide deeper analysis on demand

📋 **FILE CATEGORIZATION:**
Organize files by clinical domain:
- **Demographics & Baseline**: table1, baseline_characteristics, demographics, enrollment
- **Primary Outcomes**: primary_endpoint, efficacy, main_results, outcomes
- **Safety**: adverse_events, safety, labs, vital_signs
- **Subgroups**: subgroup, stratified, sensitivity
- **Quality/Methods**: disposition, protocol_deviations, inclusions_exclusions

✅ **GUIDING PRINCIPLES:**
- Be proactive: find the most important information without being asked
- Be precise: cite file names and exact values
- Be clinical: focus on what matters to researchers (patient safety, efficacy, data quality)
- Be structured: return JSON for cards, prose for explanations
- Flag issues: missing data, outliers, inconsistencies

**EXAMPLE AUTO-ANALYSIS OUTPUT:**
```json
{"type": "summary", "content": "This study analyzed 1,247 patients across two treatment groups..."}
{"type": "metric", "category": "cohort", "label": "Total Patients", "value": "1,247"}
{"type": "metric", "category": "demographics", "label": "Mean Age", "value": "62.4 years"}
{"type": "flag", "severity": "warning", "message": "12% missing data in exposure variable"}
```
""",
    deps_type=TLFContext,
)


@agent.tool
async def list_files(ctx: RunContext[TLFContext], category: str | None = None) -> str:
    """List all output files from this study execution.
    
    Args:
        category: Optional filter by category: 'table', 'listing', 'figure', 'report', 
                  'code', 'log', 'metadata', or 'other'. If None, shows all files.
    
    Returns a formatted list with file paths, categories, and descriptions.
    """
    manifest = ctx.deps.manifest
    raw_files = manifest.get("files", [])
    
    # Handle two manifest formats:
    # 1. Raw manifest (from tlf_import): files is a list of strings (paths)
    # 2. Enriched manifest: files is a list of dicts with {path, category, description}
    
    files = []
    for f in raw_files:
        if isinstance(f, str):
            # Raw format - enrich on the fly
            files.append(_describe_file(f))
        elif isinstance(f, dict):
            # Already enriched
            files.append(f)
    
    if category:
        files = [f for f in files if f.get("category") == category]
    
    if not files:
        return f"No files found" + (f" in category '{category}'" if category else "")
    
    # Group by category
    by_cat = {}
    for f in files:
        cat = f.get("category", "other")
        by_cat.setdefault(cat, []).append(f)
    
    lines = [f"📁 **Available files ({len(files)} total):**\n"]
    for cat, items in sorted(by_cat.items()):
        lines.append(f"\n**{cat.upper()}** ({len(items)} files):")
        for f in items:
            path = f.get("path", "")
            desc = f.get("description", "")
            lines.append(f"  • `{path}` — {desc}")
    
    # Emit tool feedback
    await ctx.deps.message_queue.put(
        json.dumps({"type": "tool", "message": f"📋 Listed {len(files)} files"})
    )
    
    return "\n".join(lines)


@agent.tool
async def read_file(ctx: RunContext[TLFContext], file_path: str) -> str:
    """Read and summarize a specific output file.
    
    Args:
        file_path: Path to the file (as shown in list_files output)
    
    Returns detailed content summary with statistics for data files.
    """
    artifacts_dir = ctx.deps.artifacts_dir
    
    # Emit tool feedback
    await ctx.deps.message_queue.put(
        json.dumps({"type": "tool", "message": f"📖 Reading {file_path}..."})
    )
    
    try:
        content = _read_file_summary(artifacts_dir, file_path)
        return content
    except Exception as e:
        return f"❌ Error reading {file_path}: {str(e)}"


@agent.tool
async def emit_dashboard_card(
    ctx: RunContext[TLFContext],
    card_type: str,
    data: dict
) -> str:
    """Emit a structured card for the dashboard.
    
    Use this during auto-analysis to send results to the frontend as you discover them.
    
    Args:
        card_type: Type of card - "summary", "insight", "issue"
        data: Card data (structure depends on card_type):
            - summary: {"content": "prose text"}
            - insight: {"text": "Main finding", "supporting_data": {"key": "value", ...}}
            - issue: {"severity": "info|warning|error", "message": "...", "details": "..."}
    
    Returns confirmation message.
    """
    card = {"type": "card", "card_type": card_type, "data": data}
    
    # Emit to frontend
    await ctx.deps.message_queue.put(json.dumps(card))
    
    return f"✓ Emitted {card_type} card"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/study/{study_id}/tlf-analyze", tags=["tlf"])
async def analyze_tlf_files(request: Request, study_id: str, body: TLFAnalyzeRequest):
    """
    Stream an AI agent analysis of study outputs with autonomous file exploration.

    Returns Server-Sent Events (text/event-stream) where each event is:
      data: {"type": "chunk", "text": "..."}     — streamed markdown text
      data: {"type": "tool", "message": "..."}   — tool execution feedback
      data: {"type": "card", "card_type": "...", "data": {...}} — dashboard card
      data: {"type": "done"}                      — end of stream
      data: {"type": "error", "message": "..."}  — error
    """
    user_id = get_authenticated_user_id(request)

    # Verify the execution belongs to this study + user
    executions = await db_manager.get_study_executions(study_id, user_id)
    record = next(
        (e for e in executions if e["execution_id"] == body.execution_id), None
    )
    if not record:
        raise HTTPException(status_code=404, detail="Execution not found.")

    manifest_path = record.get("manifest_path")
    if not manifest_path:
        raise HTTPException(status_code=404, detail="No manifest for this execution.")

    artifacts_dir = _storage.dirname(manifest_path)
    
    # Load full manifest
    try:
        manifest = _storage.read_json(manifest_path)
    except Exception:
        manifest = {"files": []}

    # Build conversation history
    user_message = body.user_instructions or "Please analyze the study outputs."
    
    # Create message queue for tool feedback
    message_queue = asyncio.Queue()
    
    # Create context
    context = TLFContext(
        study_id=study_id,
        execution_id=body.execution_id,
        artifacts_dir=artifacts_dir,
        manifest=manifest,
        message_queue=message_queue,
    )

    async def stream():
        try:
            # Helper to drain tool messages
            async def drain_message_queue():
                while True:
                    try:
                        msg = message_queue.get_nowait()
                        yield f"data: {msg}\n\n"
                        await asyncio.sleep(0)
                    except asyncio.QueueEmpty:
                        break
            
            # Stream the agent response
            async with agent.run_stream(
                user_message, deps=context, model_settings={"max_completion_tokens": 4000}
            ) as result:
                async for text_chunk in result.stream_text(delta=True):
                    # Drain tool messages first
                    async for msg in drain_message_queue():
                        yield msg
                    
                    # Then stream AI text
                    if text_chunk:
                        yield f"data: {json.dumps({'type': 'chunk', 'text': text_chunk})}\n\n"
                        await asyncio.sleep(0)
            
            # Final drain
            async for msg in drain_message_queue():
                yield msg
                
        except Exception as e:
            logger.error("TLF analysis agent failed: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/study/{study_id}/tlf-auto-analyze", tags=["tlf"])
async def auto_analyze_tlf(request: Request, study_id: str, body: TLFAnalyzeRequest):
    """
    Auto-analyze study outputs on page load.
    
    The AI agent autonomously:
    1. Lists all files
    2. Identifies key files (demographics, outcomes, safety, etc.)
    3. Reads them and extracts structured metrics
    4. Emits dashboard cards as they're discovered
    
    Returns Server-Sent Events with structured cards for the dashboard.
    """
    user_id = get_authenticated_user_id(request)

    executions = await db_manager.get_study_executions(study_id, user_id)
    record = next(
        (e for e in executions if e["execution_id"] == body.execution_id), None
    )
    if not record:
        raise HTTPException(status_code=404, detail="Execution not found.")

    manifest_path = record.get("manifest_path")
    if not manifest_path:
        raise HTTPException(status_code=404, detail="No manifest for this execution.")

    artifacts_dir = _storage.dirname(manifest_path)
    
    try:
        manifest = _storage.read_json(manifest_path)
    except Exception:
        manifest = {"files": []}

    message_queue = asyncio.Queue()
    
    context = TLFContext(
        study_id=study_id,
        execution_id=body.execution_id,
        artifacts_dir=artifacts_dir,
        manifest=manifest,
        message_queue=message_queue,
    )

    # Auto-analysis prompt
    auto_prompt = """Perform an automatic analysis of this study's outputs.

Your task is to create THREE sections for the dashboard:

1. EXECUTIVE SUMMARY (emit_dashboard_card with card_type="summary")
   - 2-3 sentences giving a high-level overview of the study
   - Include: sample size, study design, primary finding (if clear)
   
2. MAIN INSIGHTS (emit multiple cards with card_type="insight")
   - 3-5 key findings that matter most
   - Each insight should have:
     * text: The main finding (e.g., "Treatment A reduced events by 32%")
     * supporting_data: Key numbers (e.g., {"Treatment A": "215 events", "Placebo": "316 events", "p-value": "0.003"})
   - Focus on: efficacy results, safety signals, notable subgroup differences
   
3. POTENTIAL ISSUES (emit cards with card_type="issue")
   - Data quality problems, inconsistencies, red flags
   - Each issue needs: severity ("warning" or "error"), message, and details
   - Examples: missing data, outliers, imbalanced groups, high dropout
   - If no issues found, emit one issue card with severity="info" saying "No data quality issues detected"

Work systematically:
1. List files to see what's available
2. Read key files (demographics, outcomes, safety, disposition)
3. Extract insights and issues
4. Emit cards as you go

Be concise and clinical. Focus on what a researcher needs to know."""

    # Check for cached analysis results
    cache_path = _storage.join(artifacts_dir, "auto_analysis_cache.json")

    async def stream():
        # ── Serve from cache if available ────────────────────────────────────
        try:
            if not body.force_refresh and _storage.isfile(cache_path):
                cached = _storage.read_json(cache_path)
                for card in cached.get("cards", []):
                    yield f"data: {json.dumps(card)}\n\n"
                    await asyncio.sleep(0)
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
        except Exception as e:
            logger.warning("Failed to read auto-analysis cache, re-running: %s", e)

        # ── Run agent and collect cards ───────────────────────────────────────
        collected_cards = []

        try:
            async def drain_message_queue():
                while True:
                    try:
                        msg = message_queue.get_nowait()
                        yield msg
                        await asyncio.sleep(0)
                    except asyncio.QueueEmpty:
                        break

            async with agent.run_stream(
                auto_prompt, deps=context, model_settings={"max_completion_tokens": 6000}
            ) as result:
                async for text_chunk in result.stream_text(delta=True):
                    async for raw_msg in drain_message_queue():
                        parsed = json.loads(raw_msg)
                        if parsed.get("type") == "card":
                            collected_cards.append(parsed)
                        yield f"data: {raw_msg}\n\n"
                    await asyncio.sleep(0)

            # Final drain
            async for raw_msg in drain_message_queue():
                parsed = json.loads(raw_msg)
                if parsed.get("type") == "card":
                    collected_cards.append(parsed)
                yield f"data: {raw_msg}\n\n"

        except Exception as e:
            logger.error("Auto-analysis failed: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        # ── Persist cache ─────────────────────────────────────────────────────
        if collected_cards:
            try:
                _storage.write_json(cache_path, {"cards": collected_cards})
            except Exception as e:
                logger.warning("Failed to write auto-analysis cache: %s", e)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _read_file_summary(artifacts_dir: str, rel_path: str) -> str:
    """Return a concise text summary of a single output file."""
    # Security: no path traversal
    clean = rel_path.replace("\\", "/")
    if ".." in clean.split("/"):
        return "⚠️ Skipped (path traversal detected)."

    if _storage.is_s3(artifacts_dir):
        full_path = _storage.join(artifacts_dir, rel_path)
    else:
        full_path = os.path.normpath(os.path.join(artifacts_dir, rel_path))
        if not full_path.startswith(os.path.normpath(artifacts_dir)):
            return "⚠️ Skipped (path traversal detected)."

    if not _storage.isfile(full_path):
        return "⚠️ File not found in storage."

    ext = os.path.splitext(full_path)[1].lower()

    try:
        if ext in (".parquet",):
            import pandas as pd
            raw = _storage.read_bytes(full_path)
            df = pd.read_parquet(io.BytesIO(raw))
            return _df_summary(df, rel_path)

        elif ext == ".csv":
            import pandas as pd
            raw = _storage.read_bytes(full_path)
            df = pd.read_csv(io.BytesIO(raw))
            return _df_summary(df, rel_path)

        elif ext in (".xlsx", ".xls"):
            try:
                import pandas as pd
                raw = _storage.read_bytes(full_path)
                
                # Read all sheets
                excel_file = pd.ExcelFile(io.BytesIO(raw))
                summaries = []
                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    sheet_summary = _df_summary(df, f"{rel_path} (Sheet: {sheet_name})")
                    summaries.append(sheet_summary)
                
                return "\n\n".join(summaries)
            except Exception as e:
                return f"[{rel_path}] Excel file (could not parse automatically): {e}"

        elif ext == ".json":
            data = _storage.read_json(full_path)
            text = json.dumps(data, indent=2)
            return f"[{rel_path}] JSON:\n{text[:4000]}" + ("\n…(truncated)" if len(text) > 4000 else "")

        elif ext in (".png", ".jpg", ".jpeg", ".svg", ".pdf"):
            # Binary figure — just note its presence and size
            try:
                size = len(_storage.read_bytes(full_path))
                return f"[{rel_path}] Binary figure file ({size / 1024:.1f} KB). Contents not readable as text."
            except Exception:
                return f"[{rel_path}] Binary figure file."

        else:
            content = _storage.read_text(full_path, errors="replace")
            if len(content) > 4000:
                content = content[:4000] + "\n…(truncated)"
            return f"[{rel_path}]:\n{content}"

    except Exception as e:
        return f"[{rel_path}] Could not read file: {e}"


def _df_summary(df, rel_path: str) -> str:
    rows, cols = df.shape
    lines = [f"[{rel_path}] {rows:,} rows × {cols} columns"]

    # Column-level stats
    col_lines = []
    for col in df.columns:
        n_null = int(df[col].isna().sum())
        pct_null = n_null / rows * 100 if rows > 0 else 0
        if df[col].dtype == object or str(df[col].dtype) in ("string", "category"):
            n_uniq = df[col].nunique()
            col_lines.append(f"  {col} (text): {n_uniq} unique, {pct_null:.0f}% null")
        else:
            try:
                col_lines.append(
                    f"  {col} (numeric): min={df[col].min()}, max={df[col].max()}, "
                    f"mean={df[col].mean():.4g}, {pct_null:.0f}% null"
                )
            except Exception:
                col_lines.append(f"  {col}: {pct_null:.0f}% null")

    lines.append("Columns:\n" + "\n".join(col_lines))

    # Data preview
    preview_rows = min(rows, 15)
    lines.append(f"\nFirst {preview_rows} rows:\n{df.head(preview_rows).to_string(index=False)}")
    return "\n".join(lines)

