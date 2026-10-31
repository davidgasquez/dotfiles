---
name: council
description: Trigger this if the user says 'council'
disable-model-invocation: true
---

# Council

Bring in two delegates to help with the user's request, usually for review or feedback. Use one strong model from each of two different providers, at high reasoning effort. If the user's instructions name council members, use those. Otherwise pick the latest flagship model from each provider, for example Claude Opus and GPT Sol.

Use Pi's `pi-subagents` extension. If only `subagents_enable` is available, call it first. Resolve available models with `subagent({ action: "models" })`, then launch two `reviewer` agents with `subagent({ workflow: "parallel", args: { tasks: [...] } })`. Give each task an explicit `cwd` and a fully qualified `model` with the `:high` thinking suffix. If you cannot reach both models, or a named member is unavailable, report it instead of substituting.

Give each delegate the request and relevant context. For review or feedback, keep their work read-only. Wait for native completion notifications, then summarize the useful findings, disagreements, and recommended next steps.

Do not let repeated reviews result in scope creep. It is your job to fight to keep scope limited.
