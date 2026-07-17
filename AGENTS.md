# AGENTS.md

## What this repo is

Personal config for [Pi](https://pi.dev) (`@earendil-works/pi-coding-agent`): extensions,
themes, skills, job presets, and the `ohmypi` CLI that wires them together on demand.
`~/.pi/agent/` is live, per-machine state — not symlinked from this repo. See `README.md`
for the full picture; `skills/productivity/using-ohmypi/SKILL.md` for the `ohmypi` command reference.

## Conventions

- Extensions (`extensions/*.ts`) run through Pi's own jiti loader, not `tsc` — no build
  step, no compiled output. Relative imports resolve via Node's classic CJS algorithm,
  which does not resolve a symlinked directory's realpath first — never symlink into
  `extensions/`.
- `cli/` is plain ESM `.mjs`, no build step, no bundler — it runs directly via `node`, a
  different runtime layer from the jiti-loaded `.ts` extensions.
- Resource paths (themes, rules files) resolve relative to the defining file's own location
  (`import.meta.url` via `fileURLToPath`), never `os.homedir()` or `ctx.cwd`, unless it's
  explicitly a project-override lookup. See `lib/theme-map.ts`'s `THEMES_DIR` pattern.
- `jobs.json` validation is schema (Zod) + a semantic pass: every extension/theme/skill name
  must exist, mutually-exclusive extension pairs (`cli/lib/conflicts.mjs`) may not co-occur
  in one job, and `"mode": "autonomous"` jobs may not select `damage-control`.
- `damage-control` / `damage-control-continue` are mutually exclusive (same hooked tool-call
  events, would double-fire). Prefer `-continue` for autonomous/unattended jobs — a hard
  block with no human present just hangs the session forever.

## Where things live

- `extensions/` — flat `<name>.ts` or folder `<name>/index.ts`.
- `themes/` — flat `<name>.json`.
- `skills/` — `<category>/<name>/SKILL.md`, any nesting depth (Agent Skills standard
  frontmatter: `name`, `description`). Each category folder has its own `README.md` index.
- `context/` — markdown snippets referenced by a job's `contextFile`.
- `jobs.json` — named presets (`extensions`, `theme`, `mode`, `skills`, `contextFile`).
- `cli/` — the `ohmypi` CLI (`run`, `toggle`, `list`, `context` subcommands).
