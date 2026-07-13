# pi-config

Personal configuration for [Pi](https://pi.dev) — a minimal, extensible terminal coding agent (`@earendil-works/pi-coding-agent`). `~/.pi` is symlinked to the root of this repo (`agent/` lives directly at the repo root) so settings, models, and credential _references_ stay version-controlled and portable across machines.

## Setup

1. Symlink this repo to `~/.pi`:
   ```bash
   ln -s /path/to/pi-config ~/.pi
   ```
2. Copy the env template and fill in your keys:
   ```bash
   cp .env.sample .env
   ```
3. Source it before starting Pi — Pi does not auto-load `.env` files, so this must happen every session:
   ```bash
   source .env && pi
   ```

## Structure

```
.
├── .env.sample                     # Template for provider API keys — copy to .env (gitignored)
├── .claude/commands/prime.md       # Claude Code slash command: onboard onto Pi's capabilities
├── justfile                        # Recipes for launching pi with specific extension stacks
├── agent/                          # Pi's actual global config root — repo root is symlinked to ~/.pi,
│   │                                so this resolves as ~/.pi/agent/
│   ├── settings.json                # Theme, default provider/model, thinking level
│   ├── models.json                  # Custom provider definitions (local MLX server `olmx`)
│   ├── auth.json                    # Provider credentials — see below (gitignored)
│   ├── damage-control-rules.yaml    # Rules consumed by extensions/damage-control*.ts
│   └── sessions/                    # Auto-saved conversation history (gitignored)
├── extensions/                     # Project-local extensions — separate from agent/, so they stay
│   │                                opt-in instead of auto-loading globally like agent/extensions/ would
│   ├── package.json                # npm deps for extensions (currently: yaml, for damage-control-rules.yaml)
│   ├── theme-map.ts                # Shared helper: per-extension theme + title assignment, theme discovery
│   ├── damage-control.ts           # Hard block — stops and asks the user on every rule violation
│   ├── damage-control-continue.ts  # Same rules, but lets the agent continue past non-destructive blocks
│   ├── theme-cycler.ts             # Ctrl+X/Ctrl+Q theme cycling, /theme picker
│   └── minimal.ts                  # Compact footer: model name + context usage bar
└── themes/                         # Project-local theme JSON files (11 custom themes; not auto-discovered by
                                     # Pi — extensions register this dir themselves via theme-map.ts)
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

Two tiers, kept deliberately separate:

- **Global** — `agent/{prompts,skills,extensions,themes}/` (none exist yet). This repo's root is symlinked to `~/.pi`, so anything here resolves as `~/.pi/agent/...` and auto-loads in every project.
- **Project-local, opt-in** — `extensions/*.ts` and `themes/*.json` at the repo root, kept as siblings of `agent/` rather than nested inside it, so they never become global or get auto-discovered by Pi. Extensions are loaded explicitly via `just` recipes in `justfile`; themes are registered by the extensions themselves (see below), not by Pi's own theme discovery.

Current extensions (`extensions/`):

| File | Purpose |
|---|---|
| `theme-map.ts` | Shared helper, not an extension itself — per-extension theme/title assignment, `registerThemeDiscovery()` to make Pi load `themes/` |
| `damage-control.ts` | Rule-based safety gate (`agent/damage-control-rules.yaml`) — hard blocks and tells the agent to stop and ask the user |
| `damage-control-continue.ts` | Same rules, but the block feedback lets the agent keep working past non-destructive violations |
| `theme-cycler.ts` | Ctrl+X/Ctrl+Q to cycle themes, `/theme` to pick one, status line + swatch widget |
| `minimal.ts` | Replaces the footer with just model name + a 10-block context usage bar |

Run via `just` (see `justfile` for the exact `-e` flag stacks, e.g. `just ext-damage-control` loads `damage-control.ts` + `minimal.ts` + `theme-cycler.ts` together):

```bash
just                        # list all recipes
just pi                      # plain pi, no extensions
just ext-damage-control      # hard-block safety gate + minimal footer + theme cycling
just ext-damage-control-continue  # adaptive-continue variant of the above
just ext-theme-cycler        # just the theme cycler + minimal footer
```

Since `extensions/*.ts` import from `themes/` via `theme-map.ts`'s `registerThemeDiscovery()` (a `resources_discover` hook), any extension that calls it gets all 11 custom themes available, independent of what's in `agent/themes/`.

Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Security

- `auth.json`, `agent/*-memory`, `sessions/`, and `.env` are gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong in this repo.
