---
name: read-web-page
description: Read the contents of a public web page as Markdown.
---

# Read Web Page

Use the `read-web-page` script for public Internet URLs:

```bash
read-web-page 'https://website.com'
```

It tries `r.jina.ai`, `markitdown`, then `defuddle.md`, returning the first successful Markdown output.

To compare all converters:

```bash
read-web-page --all 'https://website.com'
```
