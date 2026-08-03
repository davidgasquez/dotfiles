---
name: consult-library
description: Query a large curated set of resources semantically.
disable-model-invocation: true
---

Use `qmd` to query a large curated set of resources semantically.

1. Read `/home/david/projects/library/.qmd/index.yml` to understand the available collections and choose relevant scopes.
2. Follow the QMD skill's search-and-retrieval workflow:
  - Run `qmd` from `/home/david/projects/library` so it uses the local index
  - Search the Handbook first for relevant personal notes.
  - Search other relevant collections to validate or expand on those notes.
  - Retrieve and read the full documents before drawing conclusions.
3. Treat Handbook notes as the preferred synthesis. When a relevant note cites an original or external source, read that source before relying on its claims, and distinguish the note's interpretation from the source.
4. Respond concisely with the most relevant findings. Cite QMD document IDs and line ranges, plus upstream URLs when consulted. Present URLs as descriptive Markdown links so they are easy to open. Include non-Handbook material only when it adds useful evidence or context.
5. If the library has no strong match, say so explicitly.
