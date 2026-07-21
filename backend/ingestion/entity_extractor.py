import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

EXTRACTION_PROMPT = """You are an information extraction system for industrial documents.
Given the document text below, extract the following entities as a JSON object:

- equipment: list of equipment names/tags (e.g., "Pump-101", "Boiler-3")
- personnel: list of people names mentioned
- dates: list of dates mentioned (format as found in text)
- documents_referenced: list of any other document names/IDs referenced
- procedures: list of procedure/permit/safety codes mentioned (e.g., "SP-45", "OISD-105")

Return ONLY valid JSON, no preamble, no markdown formatting, no explanation.
If a category has no entities, return an empty list for it.

Document text:
{text}
"""

def extract_entities(text: str) -> dict:
    """
    Sends document text to Groq (Llama model) and returns extracted entities as a dict.
    """
    truncated_text = text[:8000]

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": EXTRACTION_PROMPT.format(text=truncated_text)}
        ],
        temperature=0.2,
    )

    raw_response = response.choices[0].message.content.strip()

    # Clean up in case model wraps in markdown fences
    if raw_response.startswith("```"):
        raw_response = raw_response.strip("`")
        if raw_response.startswith("json"):
            raw_response = raw_response[4:]

    try:
        entities = json.loads(raw_response)
    except json.JSONDecodeError:
        print("Warning: Could not parse JSON. Raw response was:")
        print(raw_response)
        entities = {
            "equipment": [],
            "personnel": [],
            "dates": [],
            "documents_referenced": [],
            "procedures": []
        }

    return entities


if __name__ == "__main__":
    sample_text = """
    Maintenance Report - Pump-101
    Date: 15 Jan 2024
    Performed by: Rajesh Kumar
    Reference: Safety Procedure SP-45, OISD-105
    Pump-101 showed abnormal vibration during routine check.
    Related to previous incident in Boiler-3 report (Doc: INC-2023-089).
    """

    result = extract_entities(sample_text)
    print(json.dumps(result, indent=2))