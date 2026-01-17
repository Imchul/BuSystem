import pymupdf4llm
import pathlib

# Input PDF file
pdf_path = "260106_2026년부터 이렇게 달라집니다.pdf"

# Output Markdown file
output_path = "policy.md"

print(f"Converting {pdf_path} to Markdown...")

# Convert
md_text = pymupdf4llm.to_markdown(pdf_path)

# Save to file
pathlib.Path(output_path).write_bytes(md_text.encode())

print(f"Successfully created {output_path}")
