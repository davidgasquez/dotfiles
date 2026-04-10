---
name: pdf
description: Use when tasks involve reading PDF files. Prefer visual checks by rendering pages (`pdf2image`) and use selfcontained Python scripts with tools such as `pdfplumber`, and `pypdf` for extraction.
---

# PDF

Read PDF files with a workflow that preserves layout awareness. Prefer visual inspection first, then use text extraction only to validate or quote specific content.

## When to use

- Read or review PDF content where layout and visuals matter.
- Validate text that belong to a PDF.

You have `markitdown[pdf,youtube-transcription]` installed.

## Workflow

1. Prefer visual review. Render PDF pages to PNGs and inspect them visually
  - Use `pymupdf`, `python-poppler` or `pdf2image` Python packages
2. Use `markitdown` CLI to get the text and verify it matches the visual one

### Markitdown

```bash
markitdown path/to/file.pdf
markitdown remote-path.com/to/file.pdf
```

Write to a file:

```bash
markitdown path/to/file.pdf -o output.md
```

## Conventions

- Use tmp/pdfs/ for intermediate files; delete when done.
- Use `uv` and PEP 723 inline metadata when writing Python scripts.
