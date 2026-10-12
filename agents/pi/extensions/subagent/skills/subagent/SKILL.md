---
name: subagent
description: Spawn and communicate with observable Pi subagents for second opinions, independent investigations, and delegated implementation work.
---

# Subagent

Use the `subagent` tool to delegate work to a separate Pi process with its own context and Ghostty window on Hyprland's `special:magic` scratchpad. Managed subagents cannot spawn nested subagents, and this skill is not loaded into their sessions.

## Spawn

Give each child a short, descriptive name. The name appears in the parent UI, while the generated id remains its stable identifier. Call the `subagent` tool with:

```json
{"action": "spawn", "name": "implementation", "prompt": "Complete task"}
```

By default, the child inherits the current Pi provider, model, and reasoning level.

The child uses the current working directory and normal Pi configuration, including tools, extensions, skills, and repository instructions. It starts with a fresh conversation; include all task instructions and relevant file paths in `prompt`. Children share the working directory; do not concurrently edit the same files.

Spawn returns a random id. Keep the id for later calls. Subagents persist after their current turn completes: `wait`, completion, and becoming idle do not terminate them. They survive `/reload`. When the spawning Pi session quits or is replaced, they are stopped and their transcripts and metadata are removed. They are not automatically relaunched.

## Inspect and wait

```json
{"action": "list"}
```

```json
{"action": "wait", "id": "<id>"}
```

Call `subagent` with `action: "list"` at any time to rediscover subagents and their ids, names, and current states if you no longer remember them.

`wait` follows the durable session state and returns the latest final assistant response. Do not infer completion from captured terminal text. Its default deadline is 60 seconds; use `timeout` to set up to 1800 seconds. If the deadline expires, it returns the current state rather than a final response; wait again when needed.

## Communicate

Idle: starts a new prompt. Busy: steers the current work.

```json
{"action": "send", "id": "<id>", "prompt": "message"}
```

Busy: waits until current work finishes, then starts another turn.

```json
{"action": "send", "id": "<id>", "prompt": "message", "followUp": true}
```

Names are 1–64 characters and need not be unique. Messages use the subagent extension's control inbox; do not send terminal keystrokes.

## Stop

```json
{"action": "stop", "id": "<id>"}
```

Explicitly stop every subagent when it is no longer needed; do not leave completed subagents running idle. This closes the Ghostty window and removes the run transcript and metadata. Read the result with `wait` before stopping. Keep an idle subagent alive only when concrete follow-up work is expected, then stop it afterward.

The interactive `/subagent` command lists active subagents spawned by the current Pi session. Selecting one reveals `special:magic` and focuses its Ghostty window. Super+S toggles the scratchpad.
