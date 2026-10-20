---
name: kaggle-run
description: Run scripts or projects on Kaggle's remote GPUs with uv, retrieve artifacts, and checkpoint/resume long jobs. Use for Kaggle compute offload, not competition research or persistent hosting.
disable-model-invocation: true
---

# Run on Kaggle

Deliver a verified remote result or a durable checkpoint plus an exact resume command. Use the official CLI through `uvx kaggle`; Kaggle is an ephemeral Linux batch runner, not an unrestricted server. Respect the user's runtime, privacy, and budget choices.

## Establish the run

- Inspect the actual entrypoint, dependencies, inputs, expected outputs, and existing checkpoint support. Accept an argument vector and working directory, not an interpolated shell command.
- Resolve only material missing inputs: required accelerator, runtime budget, sensitive upload permission, and resume behavior. Don't assume GPU VRAM is pooled or that dependencies support the available CUDA/Python versions.
- Check `uvx kaggle quota` and relevant `--help`. If authentication is missing, request `uvx kaggle auth login`; never print credentials or embed local credentials in remote code.
- Create a unique run/chunk ID and local `.kaggle/runs/<id>/` receipt recording source SHA-256, entrypoint/args, dependency lock, input identities, parent checkpoint, kernel ref/version, budget, and expected artifacts. Exclude this directory from source bundles and version control.

## Package and launch

1. Lock Python dependencies: `uv lock --script script.py` for PEP 723 scripts, or `uv lock` for projects. Include `script.py.lock`, or `pyproject.toml` and `uv.lock`, respectively. Inline script metadata ignores project dependencies; don't add it to a project entrypoint accidentally. uv environments don't inherit Kaggle's preinstalled packages; declare CUDA-enabled wheels explicitly when required.
2. Ship only needed source/config/inputs, including intended uncommitted edits. Exclude `.git`, environments, caches, credentials, `.env`, and unrelated private data. For a tiny script, embed the payload in the bootstrap. For a project, create a ZIP named `source.bundle` (opaque extension prevents Kaggle auto-extraction), upload it as a **private** dataset, wait for `datasets status` to report ready, and attach it via `dataset_sources`. Don't assume `kernels push` uploads sibling project files. Use a new content-addressed dataset slug when immutable inputs matter.
3. Generate a small Python `run.py` bootstrap as the kernel's `code_file`. Kaggle starts this bootstrap with its Python; the bootstrap must actually invoke uv remotely. It should:
   - Verify the bundle digest, validate archive paths, and extract to `/kaggle/working/project`; `/kaggle/input` is read-only. Locate attached files explicitly and fail on missing/ambiguous matches.
   - Install a recorded uv version from Astral's versioned installer into `/tmp/uv-bin`, with `UV_UNMANAGED_INSTALL=/tmp/uv-bin`. Download the installer to a file with an HTTP timeout, then run it with checked exit status; don't hide curl failures in a pipeline. Use `/tmp/uv-bin/uv` explicitly.
   - Put environments/caches outside saved output (`UV_PROJECT_ENVIRONMENT`, `UV_CACHE_DIR`, and `UV_PYTHON_INSTALL_DIR` under `/tmp`). Enable unbuffered Python output. Report interpreter, uv, and accelerator details; fail if the required device is unavailable.
   - Run the argument vector with `subprocess.Popen(..., cwd=project, env=...)`, drain stdout/stderr concurrently into live logs and artifact files, and print a periodic flushed heartbeat while waiting. Include setup time in the budget.
   - Run scripts with `uv run --locked --script script.py ...`; projects with `uv run --locked <entrypoint> ...`. For non-Python jobs, use the project's declared runtime and lockfile rather than pretending uv manages it. Verify required native tools before expensive work.
   - Preserve the child's exit status and write a final receipt even on ordinary failures. Never turn a nonzero exit into success. Save requested artifacts under `/kaggle/working/artifacts/`; keep dependencies and temporary source out of the final output when safe.
4. Initialize metadata with `uvx kaggle kernels init -p <kernel-dir>`, then set:

```json
{
  "id": "<owner>/<unique-run-slug>",
  "title": "<Unique Run Slug>",
  "code_file": "run.py",
  "language": "python",
  "kernel_type": "script",
  "is_private": true,
  "enable_gpu": true,
  "enable_internet": true,
  "machine_shape": "NvidiaTeslaT4",
  "dataset_sources": [],
  "competition_sources": [],
  "kernel_sources": [],
  "model_sources": []
}
```

Keep title and slug aligned. `NvidiaTeslaT4` requests two T4s, but verify actual hardware at runtime. Enable internet for uv/dependency setup; for offline jobs, attach all required wheels/binaries and disable it. Check current CLI/account accelerator support rather than copying retired GPU names.

## Checkpoint contract

- Reuse the application's checkpoint API. For independent work units, persist completed IDs and outputs; for training, persist model, optimizer, scheduler/scaler, step, sampler, and RNG states as needed. A process cannot be generically checkpointed by this skill. If resume is unsupported, add the smallest task-specific mechanism or clearly report that limitation.
- Write checkpoints to `/kaggle/working/artifacts/checkpoints/` using a temporary file in the same directory followed by atomic rename. Include schema/version, progress cursor, source/config/input identities, and digests; retain the previous valid checkpoint until the new one is verified. Test save → load → continue on a tiny workload first.
- Set a **soft deadline** comfortably before the CLI hard timeout, reserving time for checkpointing and artifact finalization. The application must stop at a safe boundary, save, and exit normally. Record `checkpointed` separately from `completed`; neither an exit code of zero nor Kaggle `COMPLETE` proves the requested workload finished.
- Local disk checkpoints are **not durable across session death**. Don't promise files survive OOM, cancellation, or hard timeout, or that running output is downloadable. Prefer bounded chunks that finish successfully, then download and verify each checkpoint before starting the next chunk. If continuous off-session durability is required, arrange an explicitly authorized external checkpoint sink using Kaggle Secrets—not embedded tokens.

## Monitor, retrieve, resume

```sh
uvx kaggle kernels push -p <kernel-dir> --accelerator NvidiaTeslaT4 -t <hard-seconds>
uvx kaggle kernels status <owner>/<slug>
uvx kaggle kernels logs <owner>/<slug> --follow
# After terminal status; use the version returned by push:
uvx kaggle kernels output <owner>/<slug>/<version> -p .kaggle/runs/<id>/output
```

- Record the push receipt before polling. Use unique slugs per chunk so latest-only status/log commands cannot observe a different run. Poll at a modest interval with a monitoring deadline. On network/API errors, retry reads with bounded backoff; **never blindly retry push**, which may launch duplicate work. Reconcile ambiguous pushes against remote versions/status first.
- On `ERROR`/cancellation, retrieve logs and whatever artifacts are available; diagnose before retrying. If monitoring expires, record that the remote job may still be running and give the exact status command; don't start another job. Never poll indefinitely or burn through quota fixing the same failure.
- Validate the downloaded receipt, exit status, workload state, expected artifact schemas/sizes/digests, and checkpoint progress. Missing artifacts mean the job is not verified. Report the kernel URL/version, hardware, result paths, progress, and any concrete blocker.
- To resume, attach the **verified** checkpoint: use the previous completed unique kernel via `kernel_sources` for an immediate chain, or upload retrieved checkpoints as a private dataset for durable reuse. Initialize dataset metadata with `uvx kaggle datasets init -p <folder>` and create with `uvx kaggle datasets create -p <folder>` (omit `--public`); use opaque archives to preserve directories. Wait for readiness, record identities/digests, and keep source and checkpoint datasets distinct.
- In the next bootstrap, verify checkpoint compatibility/digests, copy it from `/kaggle/input` to the writable artifacts directory, and pass the application's explicit resume argument. Fail on an incompatible or requested-but-missing checkpoint; don't silently restart. Don't update/delete prior kernels or datasets before their checkpoint has been secured.
- Finish only after verified final artifacts are local, or after a verified durable checkpoint and a reproducible resume recipe are local. Creating a kernel is not completion. Do not submit competitions, publish data, or install unofficial interactive runners as side effects.

## References

Consult as needed; installed CLI help wins over newer documentation:
- [Official kernels workflow](https://github.com/Kaggle/kaggle-cli/blob/main/skills/references/kernels.md)
- [Kernel metadata](https://github.com/Kaggle/kaggle-cli/blob/main/docs/kernels_metadata.md)
- [uv scripts and locks](https://docs.astral.sh/uv/guides/scripts/)
