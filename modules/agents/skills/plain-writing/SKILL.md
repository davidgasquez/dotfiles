---
name: plain-writing
description: Writes and rewrites prose, summaries, and lists so a reader without context understands them in one pass. Use for /plain-writing or deslopify.
disable-model-invocation: true
---

# Plain writing

Write so that a smart reader who lacks your context understands the text in one pass. For docs, READMEs, and RFCs, also pick a structure from [technical-writing](https://github.com/backnotprop/pstack/blob/main/skills/technical-writing/SKILL.md). After drafting, reread the text as that reader and fix whatever they would stumble on.

## Structure

- Lead with the point. In chat, restate the problem in a sentence before saying what changed, and skip the history.
  - Before: The exporter now waits on the reset header, and the tests pass.
  - After: The log exporter reread whole hours, so retries wrote duplicate events. It now waits for the reset header, and the six acceptance tests pass.
- Open each paragraph with its main point, then support it with a fact or example.
- Walk through sequences in order, one step per sentence or numbered item.
- Prefer prose for explanations. Keep a list to about four items, nesting extra items under groups.

## Sentences

- Use plain everyday words and established terms, and define a technical term the reader may not know. Call each thing by one name, using the real file, command, or symbol name.
- Use the concrete name instead of a coined term, metaphor, or slogan: "base" for "substrate", "the API" for "the API surface", "a limit that only decreases" for "a ratchet". [unslop](https://github.com/backnotprop/pstack/blob/main/skills/unslop/SKILL.md) lists more of these patterns.
- Name the actor in active voice: "the loader parses the file".
- State the mechanism or number.
  - Before: This change matters and makes ranking much faster.
  - After: The new ranking model cut p95 latency from 900 ms to 220 ms.
- Write complete sentences with articles and verbs, and spell out arrows and abbreviations.
- Join closely related clauses with "and", "because", or "so", and give unrelated ideas their own sentences.
  - Before: The gate runs on every merge. It blocks regressions. Nobody bypasses it.
  - After: The gate runs on every merge and blocks any change that fails a regression case.
- Say directly what a thing is, and end the sentence when the fact ends instead of adding an "-ing" phrase such as "ensuring reliability".
- Repeat the noun when "this", "that", or "it" could point at more than one thing.

## Lists and feeds

Readers scan the first two words of each item and assume that every difference between items means something, as [Making AI text readable at scale](https://fsdatalab.github.io/blog/agent-text-at-scale) explains with examples.

- Start each item with its verb or subject, in the tense readers expect: past for done, continuous for active, future for planned. Drop a subject that every item shares.
  - Before: `KV persistence`, `Login bug fixed by agent`
  - After: `Adding KV persistence`, `Fixing login bug`
- Put the words that tell items apart first: `Shipped: order #1001`, not `Your order #1001 has shipped`.
- Give every item the same structure, vocabulary, and kind of detail, with verbs whose tone matches the purpose, such as "Users complain" for problems.

## Formatting

- Use sentence case headings, straight quotes, and commas, periods, or "to" in place of em dashes, en dashes, and middle dots.
- Use colons only to introduce a list or as a short label such as "Summary:", and bold only for terms the reader must find.

## Deslopify

When the user asks to deslopify, rewrite the previous response, or the given text, for a sharp reader with no project context. Return only the rewrite.
