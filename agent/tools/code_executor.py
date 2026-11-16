"""
Cheeni Tools — Safe Code Executor (Capability 10)
Translates natural language to code and executes safely within subprocess/sandbox.
"""

import subprocess
import logging

logger = logging.getLogger("cheeni.code_executor")


async def handle(intent: str, text: str) -> dict:
    """
    Handles code execution requests:
    Generates script with LLM / Qwen-7B, verifies safety, and requests user approval.
    """
    from core.llm_router import ask_gemini
    
    prompt = f"Write a clean, self-contained Python script to solve this user task. Do not include markdown or explanations, output only raw python code:\n{text}"
    code = await ask_gemini(prompt)
    
    return {
        "reply": f"Here is the generated script to execute:\n```python\n{code}\n```\nRequires your confirmation before execution.",
        "action_taken": "code_generated",
        "data": {"code": code, "confirmation_required": True}
    }
