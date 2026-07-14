# pi-config

Personal configuration for [Pi](https://pi.dev) — a minimal, extensible terminal coding agent (`@earendil-works/pi-coding-agent`). `~/.pi` is symlinked to the root of this repo (`base/` lives directly at the repo root) so settings, models, and credential _references_ stay version-controlled and portable across machines.

## Setup

1. Symlink this repo to `~/.pi`:
   ```bash
   ln -s /path/to/oh-my-pi ~/.pi
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
├── package.json                    # devDependencies for editor/type-checking support (see below);
│                                    # yaml is the one real runtime dependency, used by damage-control*.ts
├── .pi/                            # Pi's actual global config root — repo root's base/ is symlinked to ~/.pi
│   └── agent/                       # This resolves as ~/.pi/agent/
│       ├── settings.json            # Theme, default provider/model, thinking level
│       ├── models.json              # Custom provider definitions (local MLX server `olmx`)
│       ├── auth.json                # Provider credentials — see below (gitignored)
│       ├── themes/                  # Symlink -> ../../themes, so Pi's global discovery finds them
│       ├── damage-control-rules.yaml # Rules consumed by extensions/damage-control*.ts
│       └── sessions/                 # Auto-saved conversation history (gitignored)
├── extensions/                     # Project-local extensions — separate from agent/, so they stay
│   │                                opt-in instead of auto-loading globally like agent/extensions/ would
│   ├── theme-map.ts                # Shared helper: per-extension theme + title assignment
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
└── themes/                         # Theme JSON files (11 custom themes) — canonical source, symlinked
                                     # into base/agent/themes/ for Pi's global discovery
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

- **Global** — `agent/{prompts,skills,extensions,themes}/`. This repo's root is symlinked to `~/.pi`, so anything here resolves as `~/.pi/agent/...` and auto-loads in every project. Only `themes/` is populated so far, as a symlink to the repo-root `themes/` directory (see below) — `prompts/`, `skills/`, `extensions/` are still empty.
- **Project-local, opt-in** — `extensions/*.ts` at the repo root, kept as a sibling of `agent/` rather than nested inside it, so extensions never become global or get auto-loaded by Pi; they're loaded explicitly via `just` recipes in `justfile`. `themes/*.json` also lives at the repo root as the canonical source, but is exposed globally via the `base/agent/themes` symlink rather than being project-local-only.

Current extensions (`extensions/`):

| File                         | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-map.ts`               | Shared helper, not an extension itself — per-extension theme/title assignment on `session_start`                                            |
| `damage-control.ts`          | Rule-based safety gate for the current project (`.pi/damage-control-rules.yaml`) — hard blocks and tells the agent to stop and ask the user |
| `damage-control-continue.ts` | Same rules, but the block feedback lets the agent keep working past non-destructive violations                                              |
| `theme-cycler.ts`            | F2/Ctrl+Q to cycle themes, `/theme` to pick one, status line + swatch widget                                                                |
| `minimal.ts`                 | Replaces the footer with just model name + a 10-block context usage bar                                                                     |
| `plan-mode/`                 | `/plan` or `Ctrl+Alt+P` toggles read-only exploration (disables `edit`/`write`, tokenizes/allowlists `bash`), owns a `plan_mode_question` clarifying-questions tool, extracts a numbered plan, tracks `[DONE:n]` progress during execution — base ported from Pi's own `examples/extensions/plan-mode/`, bash-safety + question-tool ported from [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions) |

Run via `just` (see `justfile` for the exact `-e` flag stacks, e.g. `just ext-damage-control` loads `damage-control.ts` + `minimal.ts` + `theme-cycler.ts` together):

```bash
just                        # list all recipes
just pi                      # plain pi, no extensions
just ext-damage-control      # hard-block safety gate + minimal footer + theme cycling
just ext-damage-control-continue  # adaptive-continue variant of the above
just ext-theme-cycler        # just the theme cycler + minimal footer
just ext-plan-mode           # plan mode + minimal footer + theme cycling
```

All 11 custom themes are available everywhere `pi` runs — `base/agent/themes` is a symlink to the repo-root `themes/` directory, so Pi's own global theme discovery (`~/.pi/agent/themes/`) picks them up without any extension needing to register the path itself.

Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Security

- `auth.json`, `agent/*-memory`, `sessions/`, and `.env` are gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong in this repo.
