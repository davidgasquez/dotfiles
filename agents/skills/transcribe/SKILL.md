---
name: transcribe
description: Transcribe local audio or video into timestamped, speaker-diarized Markdown and JSON. Use for recordings, meetings, interviews, podcasts, or requests asking who said what.
disable-model-invocation: true
---

# Transcribe

```bash
transcribe-audio --output-dir <directory> <media-file>
```

The default language is English. Fail clearly for other languages rather than silently using another engine.

The command writes:

- `<name>.transcript.md`: timestamped turns labeled `S01`, `S02`, and so on.
- `<name>.transcript.json`: source segments and inference metadata for auditing.

## Workflow

1. Confirm the input exists and choose the user-requested output directory, or the input directory when unspecified.
2. Run `transcribe-audio`. Do not invoke `transcribe-cli` directly.
3. Read the Markdown result and report both output paths.
4. Show short transcripts directly. For long transcripts, provide the path and only summarize when requested.

## Speaker labels

Speaker labels are anonymous and recording-local. Never infer a person's identity from their voice or replace labels with names unless the user supplies an explicit mapping. Keep transcription and any requested summary clearly separate.
