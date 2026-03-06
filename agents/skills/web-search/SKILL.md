---
name: web-search
description: Generic web search. Use when you need fast, headless web search.
---

# Web Search

Search the web in a headless and fast way.

## Search Workflow

1. Run the codex exec search
2. Open or fetch the most relevant pages
3. Merge, deduplicate, and use the findings accordingly
4. Repeat if needed

## Codex exec Search

Use `codex exec` non-interactively and capture only the final assistant message:

```bash
tmp="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$tmp" "$err"' EXIT

if codex -m gpt-5.3-codex-spark exec --skip-git-repo-check --ephemeral \
  --output-last-message "$tmp" \
  "Search the web for: <QUERY>" \
  >/dev/null 2>"$err"
then
  cat "$tmp"
else
  cat "$err" >&2
  exit 1
fi
```

- Do not use `--json` here. It emits the full event stream and pollutes context
- `--output-last-message` writes the final assistant message to a file
- Codex still writes run metadata and logs to stderr
- Redirect stderr to a temp file and replay it only on failure
- Use `-C <DIR>` when search needs repo context

Example:

```bash
tmp="$(mktemp)"
err="$(mktemp)"
trap 'rm -f "$tmp" "$err"' EXIT

if codex -m gpt-5.3-codex-spark exec --skip-git-repo-check --ephemeral \
  --output-last-message "$tmp" \
  "Search the web for the latest stable Rust release and cite the best sources" \
  >/dev/null 2>"$err"
then
  cat "$tmp"
else
  cat "$err" >&2
  exit 1
fi
```

## Readable page fetch

Use `r.jina.ai` to fetch readable text or markdown for specific pages.

```bash
curl -fsSL "https://r.jina.ai/https://example.com/article"
```

Notes:

- Prepend `https://r.jina.ai/` to any HTTP or HTTPS URL
- Output is readable text or markdown for the target page

## Default Behavior

When asked to search the web:

- run codex exec search
- fetch the most relevant pages as needed
- use `r.jina.ai` when a readable page view helps
- provide an answer with the best results
