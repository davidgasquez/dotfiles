---
name: "pdf"
description: "Use when tasks involve reading or reviewing PDF files. Extract text directly or do visual checks by rendering pages when layout or suspected missing data."
disable-model-invocation: true
---

# PDF

- Use Poppler tools (check `pdftotext` or `pdftoppm` help) to read PDFs quickly
- Use `pdftoppm` when layout matters or there is non-text relevant data (scanned pages, images, tables, ...)
  - Poppler does not OCR scanned PDFs. Render pages first, then look at them id needed
- If needed, work and generate temporary files under `/tmp/pdfs/`

## Working with PDFs

If you need to generate or do something extra, use `uvx` to run packages like `reportlab`, `pdfplumber`, `pypdf`.
