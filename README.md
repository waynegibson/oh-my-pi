# oh-my-pi

Personal configuration for [Pi](https://pi.dev) — a minimal, extensible terminal coding agent (`@earendil-works/pi-coding-agent`). `~/.pi/agent/` is **live, per-machine state** (`settings.json`, `models.json`, `auth.json`, `sessions/`) — it is not symlinked from this repo. This repo holds only the shareable, versioned source material: extensions, themes, job presets, and the `ohmypi` CLI that wires them together on demand.

## Setup

1. Install dependencies and link the CLI globally:
   ```bash
   npm install
   npm link
   ```
2. Symlink the one piece of live config this repo still owns the source of truth for:
   ```bash
   ln -s /path/to/oh-my-pi/damage-control-rules.yaml ~/.pi/agent/damage-control-rules.yaml
   ```
3. Copy the env template and fill in your keys:
   ```bash
   cp .env.sample .env
   ```
4. Source it before starting Pi — Pi does not auto-load `.env` files, so this must happen every session:
   ```bash
   source .env && pi
   ```

`~/.pi/agent/settings.json`, `models.json`, `auth.json`, and `sessions/` are not part of this repo — they're local, per-machine state you manage directly (or via `ohmypi toggle`, see below).

## Structure

```
.
├── .env.sample                     # Template for provider API keys — copy to .env (gitignored)
├── .claude/commands/prime.md       # Claude Code slash command: onboard onto Pi's capabilities
├── package.json                    # commander/zod/chalk/@inquirer/prompts/yaml deps; bin: ohmypi
├── jobs.json                       # Named extension(+theme) presets — see "Extending Pi" below
├── damage-control-rules.yaml       # Canonical rules source — symlinked to
│                                    # ~/.pi/agent/damage-control-rules.yaml (see Setup)
├── lib/                            # Shared helper modules — not extensions themselves, so kept
│   └── theme-map.ts                 # out of extensions/ where Pi's auto-discovery would try to
│                                     # load them as one. Per-extension theme/title assignment.
├── extensions/                     # Extensions never auto-load by existing in this repo — they're
│   │                                loaded explicitly via `ohmypi run` or persisted via `ohmypi toggle`
│   ├── damage-control.ts           # Hard block — stops and asks the user on every rule violation
│   ├── damage-control-continue.ts  # Same rules, but lets the agent continue past non-destructive blocks
│   ├── theme-cycler.ts             # F2/Ctrl+Q theme cycling, /theme picker
│   ├── minimal.ts                  # Compact footer: model name + context usage bar
│   └── plan-mode/                  # Folder-style extension — read-only planning mode
│       ├── index.ts                 # Entry point, ported from Pi's own examples/extensions/
│       ├── utils.ts                 # Plan-step extraction, fail-closed session-state restore
│       ├── tool-policy.ts           # Bash safety tokenizer (ported from narumiruna/pi-extensions)
│       ├── question-tool.ts         # Owned plan_mode_question tool (ported from narumiruna/pi-extensions)
│       └── README.md
├── themes/                         # Theme JSON files (11 custom themes) — canonical source, reached
│                                     # only via per-extension registration or `ohmypi run --theme`
└── cli/                            # ohmypi — job-scoped extension/theme launcher (see below)
    ├── index.mjs                    # commander entry, bin target
    ├── lib/                          # discovery, settings I/O, jobs.json loading+validation,
    │                                  # conflict checking, the shared non-interactive input resolver
    └── commands/                     # run.mjs, toggle.mjs, list.mjs
```

## Authentication (`auth.json`)

Pi resolves provider credentials in this order: CLI `--api-key` flag → `auth.json` entry → environment variable → `models.json` `apiKey`. `auth.json` entries support `$ENV_VAR` interpolation, so the file can reference `.env` without ever storing a literal secret:

```jsonc
{
  "anthropic": {
    "type": "oauth",
    "refresh": "...",
    "access": "...",
    "expires": 0,
  }, // set via /login
  "openai": { "type": "api_key", "key": "$OPENAI_API_KEY" },
  "google": { "type": "api_key", "key": "$GEMINI_API_KEY" },
  "openrouter": { "type": "api_key", "key": "$OPENROUTER_API_KEY" },
}
```

- `anthropic` stays on OAuth (Claude Pro/Max subscription billing) — set inside Pi with `/login`, not from `.env`.
- `openai`, `google`, and `openrouter` resolve from the matching `.env` variable at request time.
- Each provider key holds **either** an OAuth entry **or** an API-key entry, never both at once — pick one per provider.
- `$VAR` interpolation only reads what's already in the process environment when `pi` starts — run `source .env` first.

## Extending Pi

Only extensions carry real per-request cost — each registers tool schemas that sit in every request whether used or not, and some conflict when stacked (see `damage-control` below). Themes are pure JSON with zero context cost; skills (none exist yet) are progressive-disclosure by Pi's own design. So job-scoped selection matters for **extensions**; themes just ride along with a job as a convenience.

Current extensions (`extensions/`):

| File                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `damage-control.ts`          | Rule-based safety gate for the current project (`.pi/damage-control-rules.yaml`) — hard blocks and tells the agent to stop and ask the user                                                                                                                                                                                                                                                                              |
| `damage-control-continue.ts` | Same rules, but the block feedback lets the agent keep working past non-destructive violations                                                                                                                                                                                                                                                                                                                           |
| `theme-cycler.ts`            | F2/Ctrl+Q to cycle themes, `/theme` to pick one, status line + swatch widget                                                                                                                                                                                                                                                                                                                                             |
| `minimal.ts`                 | Replaces the footer with just model name + a 10-block context usage bar                                                                                                                                                                                                                                                                                                                                                  |
| `plan-mode/`                 | `/plan` or `Ctrl+Alt+P` toggles read-only exploration (disables `edit`/`write`, tokenizes/allowlists `bash`), owns a `plan_mode_question` clarifying-questions tool, extracts a numbered plan, tracks `[DONE:n]` progress during execution — base ported from Pi's own `examples/extensions/plan-mode/`, bash-safety + question-tool ported from [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions) |

`damage-control` and `damage-control-continue` are mutually exclusive — they hook the same events and would double-fire if both loaded. `ohmypi` refuses this combination with a hard error rather than silently picking one.

### `jobs.json` — named presets

```json
{
  "backend-fix": { "extensions": ["damage-control-continue", "minimal"], "theme": "nord" },
  "safe-explore": { "extensions": ["damage-control", "plan-mode", "minimal"], "theme": "gruvbox" }
}
```

`ohmypi` validates this file at load time: every extension/theme name must exist, and no job may select two extensions from the same mutually-exclusive group.

### `ohmypi run` — ephemeral, one session

```bash
ohmypi run backend-fix                          # launch pi with the job's extensions + theme
ohmypi run -e damage-control -e minimal          # ad hoc, no job needed
ohmypi run backend-fix -t dracula                # override the job's theme
ohmypi run backend-fix --dry-run                 # print the resolved plan as JSON, don't launch pi
ohmypi run backend-fix -- --print "fix the bug"  # everything after -- passes straight to pi
```

With no job/flags given in an interactive terminal, `ohmypi run` prompts you to pick a job. Called non-interactively (no TTY, no flags) it fails loudly instead of guessing — this is what lets an orchestrator (e.g. a cmux-style tool spinning up one `pi` per window) call it deterministically: `ohmypi run <job> --dry-run` returns the resolved extension/theme paths for the orchestrator to inspect, or `ohmypi run <job>` launches directly.

Every subcommand resolves input in the same order: **explicit flags → `--json '<str>'`/piped stdin → environment variable (`OHMYPI_RUN`, `OHMYPI_TOGGLE_SET`) → interactive prompt** (only reached when stdin is a TTY).

### `ohmypi toggle` — persistent, always-on

```bash
ohmypi toggle                          # interactive checkbox (replaces the old toggle-extensions.mjs script)
ohmypi toggle --set minimal,theme-cycler   # non-interactive, full replacement list
echo '{"set":["minimal"]}' | ohmypi toggle # same, via piped JSON
```

Writes **absolute** paths into the real `~/.pi/agent/settings.json`'s `extensions` array — the documented "additional paths via settings.json" mechanism (docs/extensions.md). This is the confirmed-working persistent mechanism; two alternatives were tried and reverted after failing an end-to-end check:

- **Relative paths in the `packages` array** — plausible from source, but empirically never loaded (no `[Extensions]` startup banner, no footer change).
- **A symlink into `~/.pi/agent/extensions/`** — every extension here imports `../lib/theme-map.ts`, and jiti (Pi's `.ts` loader) resolves relative imports via Node's classic CJS algorithm, which does not resolve a symlinked directory's realpath first, so that import failed.

Because `settings.json`'s `extensions` array holds absolute, machine-specific paths, re-run `ohmypi toggle` once after cloning this repo to a different path on a new machine.

### `ohmypi list [--json]`

Lists available job/extension/theme names — the discovery step to call before `run`. `--json` emits `{"jobs":[...],"extensions":[...],"themes":[...]}` for scripts/orchestrators.

## Themes

Themes have zero context cost, so there's no need to scope them the way extensions are scoped — but they're also not blanket-discovered globally, to keep the startup `[Themes]` banner relevant to what's actually running. Each extension registers only what it needs via `lib/theme-map.ts`'s `registerThemeDiscovery()`, called once in every extension's factory body:

- Any extension **other than** `theme-cycler.ts` registers just its own `THEME_MAP`-assigned theme file (e.g. `plan-mode` → only `nord.json`) — the banner shows exactly what's relevant to what's actually running.
- `theme-cycler.ts` registers the whole `themes/` directory — cycling (`F2`/`Ctrl+Q`) or picking (`/theme`) needs the full set to mean anything. Stack it alongside anything else (`ohmypi run -e plan-mode -e theme-cycler -e minimal`) to get both the assigned theme _and_ the ability to override it.
- `ohmypi run --theme <name>` (or a job's `"theme"` field in `jobs.json`) is a third path: it passes `--theme <path>` straight to `pi`'s own CLI flag, independent of any extension's registration.

`~/.pi/agent/settings.json`'s own `"theme"` field should stay the built-in `"dark"`, not a custom theme — that field is Pi's own early-startup default, applied _before_ `resources_discover` fires, so a custom theme there errors and flash-falls-back the moment no extension happens to register it first. Each extension's own dynamic `ctx.ui.setTheme()` call 150ms later is what actually applies a custom theme.

One residual, harmless side effect: extensions with overlapping `THEME_MAP` assignments (`minimal.ts` and `theme-cycler.ts` both map to `synthwave`) produce a small theme-collision notice when stacked together — Pi resolves it correctly (keeps one, skips the duplicate copy), it's just startup noise, not a functional issue.

Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Security

- `auth.json`, `models.json`, and `sessions/` live only at `~/.pi/agent/` — outside this repo entirely, nothing to gitignore here.
- `.env` is gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong anywhere in this setup.
