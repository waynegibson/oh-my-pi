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
├── package.json                    # devDependencies for editor/type-checking support (see below);
│                                    # yaml is the one real runtime dependency, used by damage-control*.ts
├── .pi/                            # Pi's actual global config root — repo root's base/ is symlinked to ~/.pi
│   └── agent/                       # This resolves as ~/.pi/agent/
│       ├── settings.json            # Theme (built-in "dark" — see below), default provider/model,
│       │                            # thinking level, extensions array (see below)
│       ├── models.json              # Custom provider definitions (local MLX server `olmx`)
│       ├── auth.json                # Provider credentials — see below (gitignored)
│       ├── damage-control-rules.yaml # Rules consumed by extensions/damage-control*.ts
│       └── sessions/                 # Auto-saved conversation history (gitignored)
├── lib/                            # Shared helper modules — not extensions themselves, so kept
│   └── theme-map.ts                 # out of extensions/ where Pi's auto-discovery would try to
│                                     # load them as one. Per-extension theme/title assignment.
├── extensions/                     # Project-local extensions — separate from agent/, so they stay
│   │                                opt-in instead of auto-loading globally like agent/extensions/ would
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
├── scripts/
│   └── toggle-extensions.mjs       # Interactive checkbox picker — which extensions load globally
└── themes/                         # Theme JSON files (11 custom themes) — canonical source. No
                                     # symlink into base/agent/themes/ anymore (see "Themes" below)
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

- **Global** — `agent/{prompts,skills,extensions,themes}/`. This repo's root is symlinked to `~/.pi`, so anything here resolves as `~/.pi/agent/...` and auto-loads in every project. Currently empty — the extensions this repo builds stay in the project-local tier below, activated either by `npm run toggle-extensions` (writing to `settings.json`'s `extensions` array, itself global-scope) or on demand via `piext`.
- **Project-local, opt-in** — `extensions/*.ts` at the repo root, kept as a sibling of `agent/` rather than nested inside it, so extensions never auto-load by just existing in this repo; they're loaded explicitly, by name, via the `piext()` shell function (see below), or persistently via `npm run toggle-extensions`. `lib/theme-map.ts` is a sibling of `extensions/`, not inside it — it has no default export and isn't itself loadable as an extension, so it'd break auto-discovery if it lived there.

Current extensions (`extensions/`):

| File                         | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `damage-control.ts`          | Rule-based safety gate for the current project (`.pi/damage-control-rules.yaml`) — hard blocks and tells the agent to stop and ask the user |
| `damage-control-continue.ts` | Same rules, but the block feedback lets the agent keep working past non-destructive violations                                              |
| `theme-cycler.ts`            | F2/Ctrl+Q to cycle themes, `/theme` to pick one, status line + swatch widget                                                                |
| `minimal.ts`                 | Replaces the footer with just model name + a 10-block context usage bar                                                                     |
| `plan-mode/`                 | `/plan` or `Ctrl+Alt+P` toggles read-only exploration (disables `edit`/`write`, tokenizes/allowlists `bash`), owns a `plan_mode_question` clarifying-questions tool, extracts a numbered plan, tracks `[DONE:n]` progress during execution — base ported from Pi's own `examples/extensions/plan-mode/`, bash-safety + question-tool ported from [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions) |

Run via `piext` (a shell function in `~/.dotfiles/functions_zsh`, not part of this repo) — pass extension names, mix any combination, from any project directory. `piext` resolves each name to `extensions/<name>.ts` or `extensions/<name>/index.ts` and runs plain `pi -e ...` with absolute paths; nothing loads unless you name it:

```bash
piext                                          # or piext --list: show available extension names
piext damage-control minimal theme-cycler      # hard-block safety gate + minimal footer + theme cycling
piext damage-control-continue minimal theme-cycler  # adaptive-continue variant of the above
piext theme-cycler minimal                     # just the theme cycler + minimal footer
piext plan-mode minimal theme-cycler           # plan mode + minimal footer + theme cycling
```

Short aliases (`pi:dc`, `pi:dcc`, `pi:theme`, `pi:plan`, `pi:list`) wrap the common combos above — see `~/.dotfiles/aliases.zsh`.

For extensions you want *always* loaded (no `piext`/`-e` needed at all), run `npm run toggle-extensions` (or `node scripts/toggle-extensions.mjs`) — an interactive checkbox picker (`@inquirer/prompts`) that writes **absolute** paths into `base/agent/settings.json`'s `extensions` array — the documented "additional paths via settings.json" mechanism (docs/extensions.md), confirmed end-to-end with a real interactive `pi` session (the `[Extensions]` startup banner appears, and `minimal.ts`'s custom footer actually renders).

Two alternatives were tried and reverted after failing that same end-to-end check, despite each looking correct from source-reading alone:

- **Relative paths in the `packages` array**, on the theory that local package sources there resolve against `agentDir` rather than `cwd` — plausible from `dist/core/package-manager.js`, but empirically the extensions never loaded (no `[Extensions]` banner, no footer change).
- **A symlink into `base/agent/extensions/`** — every extension here imports `../lib/theme-map.ts`, and jiti (Pi's `.ts` loader) resolves relative imports via Node's classic CJS algorithm, which does not resolve a symlinked directory's realpath first, so that import failed to resolve.

Trade-off of the working version: absolute paths are machine-specific, so this one array in `base/agent/settings.json` isn't portable if the repo is cloned to a different path — re-run `npm run toggle-extensions` once after cloning elsewhere to regenerate correct paths for that machine.

## Themes

`themes/` (11 custom JSON files) is **not** symlinked into `base/agent/themes/` — Pi always scans that directory by default regardless of what's explicitly registered, so a blanket symlink there means every theme gets discovered (and shown in the startup `[Themes]` banner) on every single launch, whether or not anything needs more than one.

Instead, each extension registers only what it needs via `lib/theme-map.ts`'s `registerThemeDiscovery()`, called once in every extension's factory body:

- Any extension **other than** `theme-cycler.ts` registers just its own `THEME_MAP`-assigned theme file (e.g. `plan-mode` → only `nord.json`) — the banner shows exactly what's relevant to what's actually running.
- `theme-cycler.ts` registers the whole `themes/` directory — cycling (`F2`/`Ctrl+Q`) or picking (`/theme`) needs the full set to mean anything. Stack it alongside anything else (`piext plan-mode theme-cycler minimal`) to get both the assigned theme *and* the ability to override it.

`base/agent/settings.json`'s own `"theme"` field is set to the built-in `"dark"`, not a custom theme — that field is Pi's own early-startup default, applied *before* `resources_discover` fires, so a custom theme there would error and flash-fallback the moment no extension happens to register it first (this was tried and reverted after the error showed up in a real interactive session). Each extension's own dynamic `ctx.ui.setTheme()` call 150ms later is what actually applies a custom theme.

One residual, harmless side effect: extensions with overlapping `THEME_MAP` assignments (`minimal.ts` and `theme-cycler.ts` both map to `synthwave`) produce a small theme-collision notice when stacked together — Pi resolves it correctly (keeps one, skips the duplicate copy), it's just a bit of startup noise, not a functional issue.

All 11 custom themes are available everywhere `pi` runs — `base/agent/themes` is a symlink to the repo-root `themes/` directory, so Pi's own global theme discovery (`~/.pi/agent/themes/`) picks them up without any extension needing to register the path itself.

Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Security

- `auth.json`, `agent/*-memory`, `sessions/`, and `.env` are gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong in this repo.
