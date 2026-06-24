---
name: web-fetch
description: Fetch the contents of a public web page as Markdown.
---

# Web Fetch

Use the `web-fetch` script for public Internet URLs:

```bash
web-fetch 'https://website.com'
```

It tries `r.jina.ai`, `markitdown`, then `defuddle.md`, returning the first successful Markdown output.

To compare all converters:

```bash
web-fetch --all 'https://website.com'
```
