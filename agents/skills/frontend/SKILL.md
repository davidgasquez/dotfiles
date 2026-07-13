---
name: frontend
description: Resources and guidelines for awesome frontend UX and design.
disable-model-invocation: true
---

Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.

## Guidelines

- Fast and efficient. Load only required data, render charts appropiately, ...
- Prefer minimal, monochrome, monospace fonts, high contrast, sharp rectangles, utilitarian layout designs. Consider datasheet and control panel style if match.
- Use semantic HTML, modern CSS
- As vanilla as possible (no React or other frameworks)
- Accesible

## Workflow

1. Read through my [preferred styles, reources, and links first](https://davidgasquez.com/handbook/web-design.md). If needed, clone GitHub repos into `/tmp` and dig into the most relevant ones.
2. Inspect the project: framework, existing components, theme, assets, vibes, and constraints.
3. Define the design read: surface type, audience, user task, brand/product register, aesthetic direction, and justified signature moves. Ask clarifying questions if needed.
4. Plan before code: content hierarchy, responsive layout, palette, typography, spacing, radius, motion, states, accessibility, and real asset needs. Reject generic AI-default patterns.
5. Implement production-quality UI with semantic HTML, maintainable CSS/JS, consistent design-system conventions, real content/assets, clear copy, visible focus, keyboard support, contrast, and reduced-motion handling.
6. Verify in browser and code: desktop/mobile, overflow, states, forms, loading/empty/error/success, interaction feedback, performance, accessibility, and build/lint/tests when available.
7. Iterate from screenshots and self-critique until the interface feels intentional, distinctive, usable, and shippable. Present what changed, what was checked, and any remaining limitations.
