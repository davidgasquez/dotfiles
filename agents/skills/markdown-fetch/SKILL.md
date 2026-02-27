---
name: markdown-fetch
description: Get URLs, PDFs and YouTube Videos as Markdown. Use to save tokens when reading websites (headings, lists, tables, links), YouTube URLs (transcripts) and PDFs (including stdin with -x or -m hints). If `markitdown` fails, fall back to `curl r.jina.ai/URL`.
---

# Markdown Fetch

Fetch websites and URLs as Markdown. Use to save tokens when reading websites (headings, lists, tables, links), YouTube URLs (transcripts) and PDFs (including stdin with -x or -m hints). If `markitdown` fails, fall back to `curl r.jina.ai/URL`.

You have `markitdown[pdf,youtube-transcription]` installed.

## Reading URLs

1. Convert websites and URLs.

Web page to Markdown:

```bash
markitdown 'https://example.com' -o page.md
```

If MarkItDown fails on a URL, fall back to r.jina.ai:

```bash
curl -fsSL 'https://r.jina.ai/https://example.com' > page.md
```

YouTube URL to transcript Markdown:

```bash
markitdown 'https://www.youtube.com/watch?v=VIDEO_ID' -o video.md
```

2. Convert PDFs.

Convert a file (stdout):

```bash
markitdown path/to/file.pdf
```

Write to a file:

```bash
markitdown path/to/file.pdf -o output.md
```

If reading from stdin, set hints so MarkItDown picks the PDF converter:

```bash
cat file | markitdown -x pdf
cat file | markitdown -m application/pdf
```
