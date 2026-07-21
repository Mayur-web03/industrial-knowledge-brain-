import os
import re
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def assess_confidence(query: str, context: str, answer: str) -> dict:
    """
    Lightweight self-critique call: asks the model to rate how well the
    generated answer is actually grounded in the provided context.
    This is far more reliable than raw embedding similarity because it
    judges the ANSWER, not just the retrieval.
    """
    system_prompt = """You are a strict grounding-verification system. Given a QUESTION,
the CONTEXT excerpts that were used, and the ANSWER that was generated, rate how well the
ANSWER is supported by the CONTEXT.

Scoring guide:
- 90-100: Fully and explicitly supported, no inference required.
- 70-89: Well supported, required reasonable connecting of dots across sources.
- 40-69: Partially supported; some claims lack direct backing or context is tangential.
- 0-39: Weakly supported, speculative, or context doesn't address the question.

Return ONLY valid JSON, no markdown, no preamble:
{"confidence": <int 0-100>, "reason": "<one short sentence>"}"""

    user_prompt = f"""QUESTION: {query}
CONTEXT:
{context}
ANSWER:
{answer}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        parsed = json.loads(raw)
        return {
            "confidence": max(0, min(int(parsed.get("confidence", 50)), 100)),
            "reason": parsed.get("reason", "")
        }
    except (json.JSONDecodeError, ValueError):
        return {"confidence": 50, "reason": "Could not verify grounding automatically."}

def generate_answer(query: str, context: str) -> str:
    """
    Sends the user query + retrieved context (from hybrid retriever) to Groq/Llama
    and returns a natural language answer grounded in that context.
    """
    system_prompt = """You are an Industrial Knowledge Assistant. You answer questions about 
industrial equipment, maintenance, incidents, and safety procedures using ONLY the context 
provided below.

Rules:
- Base your answer strictly on the given context (document excerpts + related entities).
- If the context mentions connections between equipment/incidents/documents, use them to 
  provide cross-document reasoning (e.g., "Pump-104's issue is related to the earlier 
  Boiler-3 incident because...").
- If the answer is not present in the context, say so clearly instead of guessing.
- Be concise and factual, like a technical assistant, not a chatbot with fluff.

CITATION RULES (strict):
- The context excerpts are labeled "[Source N: filename]". Only cite a source if you
  actually used specific information from THAT excerpt to support the sentence you're
  writing.
- Do NOT cite a source just because it appeared in the context — several excerpts may
  only be loosely or topically related (same equipment type, nearby date, etc.) without
  actually answering the question. Loosely-related is not the same as relevant: skip it.
- Never cite more sources for a claim than actually support it. One well-matched source
  beats three loosely-matched ones.
- Only use filenames that literally appear in the "[Source N: filename]" labels above —
  never invent or guess a document name.
- If none of the provided excerpts directly address the question, say so explicitly
  instead of citing the closest-sounding one.

FORMATTING — pick exactly ONE of the three formats below based on the question type:

1. FAILURE / INCIDENT / ANOMALY questions (e.g. "why did X happen", "what caused the
   failure in Y"):
   Structure your answer using exactly these four labeled sections, each on its own line:
   SYMPTOM: <what was observed right now, in this specific record>
   CONTRIBUTING FACTOR: <conditions or events that contributed>
   ROOT CAUSE: <the underlying cause, if determinable from context; say "not
   conclusively determinable from available records" if it isn't>
   RECOMMENDATION: <a concrete next action>
   Skip a section only if the context genuinely gives nothing for it — do not
   fabricate content to fill a section.

2. CONNECTION / RELATIONSHIP / CROSS-REFERENCE questions (e.g. "is A connected to B",
   "is this related to the earlier incident", "has this happened before"):
   Structure your answer using exactly these two labeled sections, each on its own line:
   CURRENT FINDING: <what the most recent/relevant record says about the specific
   equipment or event asked about, in this instance only>
   HISTORICAL CONTEXT: <what prior incidents, reports, or patterns from other documents
   show, and how they relate to the current finding — this is where cross-document
   reasoning goes>
   Do not blend the two into one paragraph — keep the current, specific finding fully
   separate from the historical/precedent reasoning, even if they support the same
   conclusion.

3. SIMPLE FACTUAL LOOKUP (e.g. "what does procedure X require", "what is SP-45"):
   Answer directly in 2-4 plain sentences. Do NOT use section labels or force either
   structure above.

Choose format 1 only for genuine failure/incident analysis, format 2 for anything asking
about a relationship or precedent between two or more things, and format 3 otherwise.
"""

    user_prompt = f"""Context:
{context}

Question: {query}

Answer:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content.strip()