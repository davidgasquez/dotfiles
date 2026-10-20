---
name: nix-run
description: Run CLI tools on demand through Nix without permanent installation. Use when you need to run a tool that is not on the system, for example when requested or referenced by another skill to resolve and execute a tool with nix run or nix shell.
---

# Nix Run

Use this skill for execution; follow the calling skill for the tool's workflow, arguments, and authorization requirements.

## Choose a package

- Reuse a flake reference supplied by the calling skill or project. Otherwise check nixpkgs, then the tool's official repository or documented Nix packaging.
- Verify the package attribute, version, and support for the current system. Use `nix search <flake> <tool>` or inspect the flake's `packages` and `apps`; do not assume the executable and package names match.
- If no maintained Nix package exists, report that limitation and use the calling skill's documented runner when available. Do not create a derivation or change system configuration just to run a command.

## Execute

Put application arguments after `--`:

```sh
nix run 'nixpkgs#jq' -- --version
nix run 'github:openclaw/nix-openclaw-tools#wacli' -- --help
```

In a calling skill's examples, replace only the executable with `nix run '<flake>#<attribute>' --`; preserve arguments, quoting, environment variables, and working directory.

If a package has multiple executables or no usable default entry point, select the executable explicitly:

```sh
nix shell 'nixpkgs#sqlite' --command sqlite3 --version
```

Verify a newly selected tool with `--help` or `--version` before using its workflow. Nix provides the executable and its packaged dependencies; browsers, desktop sessions, GPU support, and external services may still need the setup documented by the tool.

## State and versions

- Run as the current user. Keep the normal home and XDG directories so authentication, indexes, and configuration persist between invocations. `nix run` is not a sandbox or a temporary user profile.
- Downloads and builds are cached in the Nix store and may be collected later. No permanent profile installation, flake input, shell alias, or service is needed.
- Reuse the same flake reference throughout a task. When an exact version is required, use a verified revision such as `github:owner/repo/<commit>#<attribute>`; unpinned references can change as Nix refreshes its cache.

Reference: [Nix run manual](https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-run.html).
