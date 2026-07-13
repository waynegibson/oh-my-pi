---
description: Onboard onto Pi — what the pi coding agent is, how it's used, and how to extend it
argument-hint: [topic]
---

Onboard me onto **Pi** (`@earendil-works/pi-coding-agent`) — the terminal coding agent that this repo (`pi-config`) configures.

1. Ground your answer in the actual installed version rather than memory:
   - Find the installed package (e.g. `find /opt/homebrew/Cellar/pi-coding-agent -maxdepth 1 -type d`, or fall back to `npm root -g`/`which pi`) and read `README.md` inside it (`libexec/lib/node_modules/@earendil-works/pi-coding-agent/README.md` for the Homebrew layout).
   - Skim `docs/prompt-templates.md`, `docs/skills.md`, and `docs/extensions.md` next to it if present — they have the precise syntax/locations that the README summarizes loosely.
2. Read this repo's local config for grounding: `base/agent/settings.json` and `base/agent/models.json`.
3. Produce a skimmable guide (tables/bullets, not prose) covering:
   - **What Pi is** — a minimal, aggressively extensible terminal coding harness. Ships with only a handful of built-in tools (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`) and deliberately skips sub-agents, plan mode, permission popups, and built-in to-dos — those are opt-in via extensions or packages, not baked in.
   - **How it's used** — the run modes (interactive TUI, print `-p`, `--mode json`, `--mode rpc`, SDK embedding); where config and sessions live (`~/.pi/agent/` global, `.pi/` per-project, only loaded once trusted); the everyday interactive commands worth knowing (`/model`, `/settings`, `/resume`, `/tree`, `/compact`, `/trust`, `/export`).
   - **How to extend it** — the four customization surfaces and where each lives globally vs. per-project:
     - Prompt templates (`prompts/*.md`) — slash commands, support `$1`/`$ARGUMENTS`/`${1:-default}` args
     - Skills (`skills/*/SKILL.md`) — Agent Skills-standard, `/skill:name` or auto-loaded
     - Extensions (`extensions/*.ts`) — TypeScript modules registering tools/commands/UI
     - Themes (`themes/*`) — hot-reloading TUI color schemes
     - How these bundle into shareable Pi Packages (`pi install npm:...` / `git:...`)
4. Ground it in *this* repo specifically: report the active provider/model/thinking level from `settings.json` and any custom providers in `models.json`, note which of `base/agent/{prompts,skills,extensions,themes}/` exist yet (likely none), and suggest one concrete first addition to start extending Pi's capabilities from here.

If a topic was given ($ARGUMENTS), focus the guide on that topic instead of the full overview.
