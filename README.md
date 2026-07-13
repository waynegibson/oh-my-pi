# pi-config

Personal configuration for [Pi](https://pi.dev) — a minimal, extensible terminal coding agent (`@earendil-works/pi-coding-agent`). `~/.pi` is symlinked to `base/` in this repo so settings, models, and credential _references_ stay version-controlled and portable across machines.

## Setup

1. Symlink this repo's `base/` directory to `~/.pi`:
   ```bash
   ln -s /path/to/pi-config/base ~/.pi
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
├── .env.sample                  # Template for provider API keys — copy to .env (gitignored)
├── .claude/commands/prime.md    # Claude Code slash command: onboard onto Pi's capabilities
└── base/                        # Symlinked to ~/.pi — Pi's actual config root
    └── agent/
        ├── settings.json        # Theme, default provider/model, thinking level
        ├── models.json          # Custom provider definitions (local MLX server `olmx`)
        ├── auth.json            # Provider credentials — see below (gitignored)
        └── sessions/            # Auto-saved conversation history (gitignored)
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

Custom prompt templates, skills, extensions, and themes go under `base/agent/{prompts,skills,extensions,themes}/` (none exist yet). Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Security

- `auth.json`, `base/agent/*-memory`, `sessions/`, and `.env` are gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong in this repo.
