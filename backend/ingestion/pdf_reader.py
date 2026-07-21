from pypdf import PdfReader
import os

def extract_text_from_pdf(file_path: str) -> str:
    """
    Reads a PDF file and returns all extracted text as a single string.
    """
    reader = PdfReader(file_path)
    full_text = ""

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            full_text += f"\n--- Page {page_num + 1} ---\n{text}"

    return full_text


def process_folder(folder_path: str) -> dict:
    """
    Reads all PDFs in a folder and returns {filename: extracted_text}.
    """
    results = {}
    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".pdf"):
            file_path = os.path.join(folder_path, filename)
            print(f"Reading: {filename}")
            results[filename] = extract_text_from_pdf(file_path)
    return results


if __name__ == "__main__":
    # Quick test - place a sample PDF in data/raw_docs/ and run this file
    folder = "../data/raw_docs"
    docs = process_folder(folder)
    for name, content in docs.items():
        print(f"\n===== {name} =====")
        print(content[:500])  # print first 500 chars as preview