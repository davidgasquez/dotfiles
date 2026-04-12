---
name: look-at
description: Analyze local PDFs, images, screenshots, scans, and diagrams. Use when visual interpretation matters, when comparing files, or when extracting targeted information from PDFs by combining visual review with exact text extraction.
---

# Look At

Use this skill for local files that need interpretation, not raw file dumps.

## Use this skill for

- PDFs where layout, scans, tables, or figures matter
- Images, screenshots, scans, and diagrams
- Targeted extraction and concise summaries

## Do not use this skill for

- Source code or plain text where exact contents matter — use `read`
- Tasks where you need to edit the file from exact source contents
- Simple file reads that do not need interpretation

You have `markitdown[pdf,youtube-transcription]` installed.

## PDF workflow

For PDFs, use a hybrid workflow:

1. Use `look-at` for layout, scans, tables, figures, and ambiguous formatting.
2. Use `markitdown` to verify exact text, quotes, and fields.
3. Use a small `uv` script with `pdfplumber`, `pypdf`, or `pymupdf` when you need targeted extraction or validation.

Run each workflow on their own `tmux` in parallel and unify at the end.

### Markitdown

```bash
markitdown path/to/file.pdf
markitdown path/to/file.pdf -o output.md
```

## Look-at inputs

Required:
- `path`: path to the file to analyze, relative or absolute

Optional:
- `objective`: what to learn, extract, summarize, or describe; pass via `--objective`
- `context`: why it matters; pass via `--context`

If `objective` or `context` are omitted, the helper uses concise defaults.

## Visual workflow

1. Make sure the primary file path exists.
2. Write a specific objective. Avoid vague prompts like “look at this”.
3. Include context so the model knows what matters.
4. Run:

```bash
look-at \
  path/to/file.pdf \
  --objective "Extract the total due, due date, and vendor name" \
  --context "I am reconciling monthly expenses and only need billing details"
```


## Rules

- Provide `objective` and `context` when you want targeted output.
- For PDFs, prefer the hybrid visual + exact extraction workflow when accuracy matters.
- Prefer targeted extraction over full transcription.
- Call out uncertainty when content is blurry, occluded, or ambiguous.
- PDFs are rendered into page images before visual analysis.
- If the input is plain text or source code, use `read` instead.
