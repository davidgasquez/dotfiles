---
name: council
description: Trigger this if the user says 'council'
disable-model-invocation: true
---

# Council

Bring in two delegates to help with the user's request, usually for review or feedback. Use one strong model from each of two different providers, at high reasoning effort. If the user's instructions name council members, use those. Otherwise pick the latest flagship model from each provider, for example Claude Opus and GPT Sol.

In T3 Code, use `orchestrator_capabilities` to resolve the models, then `delegate_task` to start one delegate per model in parallel. If you cannot reach both models, or a named member is unavailable, report it instead of substituting.

Give each delegate the request and relevant context. For review or feedback, keep their work read-only. Collect their responses and summarize the useful findings, disagreements, and recommended next steps.

Do not let repeated reviews result in scope creep. It is your job to fight to keep scope limited.
