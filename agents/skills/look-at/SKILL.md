---
name: look-at
description: Analyze local PDFs, images, screenshots, and scans with multi-modal model to extract specific information or summaries without returning raw file contents. Use when read cannot interpret the file well or when you need analyzed findings instead of literal contents.
---

# Look At

Use this skill when you need a model to inspect a local file and extract findings, not dump the file verbatim.

Implementation note: with the current `pi` CLI, the helper script attaches supported images directly and renders PDFs into page images before asking GPT-5.4. It does not yet support arbitrary binary media inputs.

## When to use

- PDFs, images, screenshots, scans, or diagrams that `read` cannot interpret well
- Extracting specific facts or concise summaries from a document
- Describing visual content in images or diagrams
- Comparing a primary file with one or more reference files

## When not to use

- Source code or plain text files where exact contents matter — use `read` instead
- Tasks where you need to edit the file afterward based on exact contents
- Simple file reads that do not need interpretation

## Required inputs

- `path`: absolute path to the file to analyze
- `objective`: clear statement of what to learn, extract, summarize, or describe
- `context`: broader goal and relevant background

## Optional inputs

- `referenceFiles`: absolute paths to reference files for comparison

## Workflow

1. Make sure the primary file path is absolute and exists.
2. Write a specific objective. Avoid vague prompts like “look at this”.
3. Include context so the model knows what matters.
4. Run:

```bash
look-at \
  --path /absolute/path/to/file.pdf \
  --objective "Extract the total due, due date, and vendor name" \
  --context "I am reconciling monthly expenses and only need billing details"
```

5. For comparisons, add one or more reference files:

```bash
look-at \
  --path /absolute/path/to/after.png \
  --objective "Describe visual regressions compared to the baseline" \
  --context "I am reviewing a UI change before merging" \
  --reference-file /absolute/path/to/before.png
```

## Rules

- Always provide both `objective` and `context`.
- Prefer targeted extraction over full transcription.
- Call out uncertainty explicitly when content is blurry, occluded, or ambiguous.
- Use reference files only when they help answer the objective.
- PDFs are rendered into page images first, then analyzed visually.
- The script uses a small focused system prompt so the model distills findings instead of echoing source material.
- If the input is plain text or source code, use `read` instead.
