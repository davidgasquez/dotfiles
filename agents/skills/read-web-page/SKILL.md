---
name: read-web-page
description: Read the contents of a web page at a given URL. Do NOT use for access to localhost or any other local or non-Internet-accessible URLs; use curl instead. Use to save tokens when reading websites (headings, lists, tables, links). If `markitdown` fails, fall back to `curl r.jina.ai/URL` or `defuddle.md/URL`.
---

# Read Web Page

Read the contents of a web page at a given URL. Do NOT use for access to localhost or any other local or non-Internet-accessible URLs; use curl instead. Use to save tokens when reading websites (headings, lists, tables, links). If `markitdown` fails, fall back to `curl r.jina.ai/URL` or `defuddle.md/URL`.

You have `markitdown[pdf,youtube-transcription]` installed.

## Reading URLs

1. Convert websites and URLs.

Web page to Markdown:

```bash
markitdown 'https://example.com' -o page.md
```

If MarkItDown fails on a URL, fall back to r.jina.ai or defuddle.md:

```bash
curl -fsSL 'https://r.jina.ai/https://example.com' > page.md
```

```bash
curl -fsSL 'https://defuddle.md/example.com' > page.md
```
