---
name: using-ohmypi
description: Understand and correctly use the ohmypi CLI and jobs.json in this repo — when to add a job, how mode/extensions/skills/theme/contextFile fields work, and how run/toggle/list/context differ. Use when asked to add, edit, or debug a job definition, or to explain what ohmypi run/toggle/list/context do.
---

# Using ohmypi

`ohmypi` is this repo's job-scoped launcher for Pi extensions, themes, skills, and context
snippets, defined in `cli/`. Two independent axes:

- **`ohmypi run [job]`** — ephemeral, one `pi` invocation. Never persists anything.
  `ohmypi run backend-fix -- --print "fix the bug"` — flags after `--` pass straight to `pi`.
  `--dry-run` prints the resolved extension/theme paths as JSON without launching `pi`.
- **`ohmypi toggle [job]`** — persistent.
  - Global scope (default): writes `~/.pi/agent/settings.json`'s `extensions` array —
    always-on for every future `pi` launch on this machine.
  - Project scope (`--scope project`, run from inside the target project): writes a `git:`
    package reference into that project's `.pi/settings.json`, portable across
    machines/teammates. Requires project trust — `pi` silently skips untrusted project
    resources in non-interactive modes (`-p`, `--mode json`, `--mode rpc`).

## jobs.json fields

- `extensions: string[]` — names from `extensions/` (flat `<name>.ts` or folder `<name>/index.ts`).
- `theme?: string` — a name from `themes/`.
- `mode: "interactive" | "autonomous"` (default `"interactive"`) — `"autonomous"` jobs
  cannot select `damage-control` (hard block, hangs with no human to answer); use
  `damage-control-continue` for unattended/orchestrator-spawned jobs.
- `skills?: string[]` — names from `skills/<name>/SKILL.md`. Only travel through
  `toggle <job> --scope project` (global-scope skill toggling isn't built yet).
- `contextFile?: string` — repo-relative path to a markdown snippet. Print it with
  `ohmypi context <job>`, or apply it to `~/.pi/agent/AGENTS.md` with `--global`.

All names are validated when `jobs.json` loads — `ohmypi list` shows everything currently
valid to reference. `damage-control` and `damage-control-continue` are mutually exclusive
(same hooked events) — selecting both in one job is a hard error.

## Adding a job

Edit `jobs.json`, then `ohmypi run <job> --dry-run` to confirm the resolved plan before
launching for real.
