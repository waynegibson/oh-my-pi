# oh-my-pi

[`@spacecomx/oh-my-pi`](https://github.com/waynegibson/oh-my-pi) — a job-scoped extension, theme, and skill launcher for [Pi](https://pi.dev) (`@earendil-works/pi-coding-agent`), plus the versioned source material (extensions, themes, skills, job presets) it wires together on demand. `~/.pi/agent/` is **live, per-machine state** (`settings.json`, `models.json`, `auth.json`, `sessions/`) — it is not symlinked from this repo; this repo holds only what's shareable and versioned. It's also, as-is, a valid Pi package — see [Referencing this repo as a package](#referencing-this-repo-as-a-package).

## Requirements

- Node.js `>=20` (declared in `package.json`'s `engines`)
- [Pi](https://pi.dev) (`@earendil-works/pi-coding-agent`) installed and on `PATH`

## Installation

There are two different audiences, with two different installation paths:

### Using extensions/skills from this repo in a project (no local checkout needed)

If you just want a project to use extensions/skills from oh-my-pi — the common case for a team member working in some other repo — you don't need to clone or install anything here. Pi resolves this repo directly as a git package:

```bash
pi install "git:github.com/waynegibson/oh-my-pi@v0.1.0"
```

or, more precisely scoped (only load specific extensions/skills, not everything), commit a `.pi/settings.json` package entry in that project — see [Referencing this repo as a package](#referencing-this-repo-as-a-package). Someone with an `ohmypi` checkout can generate this for you with `ohmypi toggle <job> --scope project`.

### Operating `ohmypi` itself (this repo)

1. Clone this repo, install dependencies, and link the CLI globally:
   ```bash
   git clone git@github.com:waynegibson/oh-my-pi.git
   cd oh-my-pi
   npm install
   npm link
   ```
   Once published to npm, this collapses to `npm install -g @spacecomx/oh-my-pi`.
2. Copy the env template and fill in your provider keys:
   ```bash
   cp .env.sample .env
   ```
3. Source it before starting Pi — Pi does not auto-load `.env` files, so this must happen every session:
   ```bash
   source .env && pi
   ```

`~/.pi/agent/settings.json`, `models.json`, `auth.json`, `sessions/`, and the live `AGENTS.md` are not part of this repo — they're local, per-machine state you manage directly (or via `ohmypi toggle` / `ohmypi context --global`, see below). `damage-control.ts`/`damage-control-continue.ts` read their global rules file directly from this repo (`damage-control-rules.yaml`, resolved relative to the extension itself) — no symlink needed.

## Development

```bash
npm install       # install dependencies
npm test          # run the vitest suite (cli/lib/*.test.mjs)
npm link          # make the local checkout's `ohmypi` resolve globally
```

Tests cover the pure/testable `cli/lib/` modules — schema validation, `jobs.json` semantic checks (unknown names, conflicts, autonomous-mode constraints), the non-interactive input precedence resolver, package-entry merge logic, and resource discovery. Commander wiring, `@inquirer/prompts` interactive flows, and the `pi` subprocess launch in `run.mjs` are exercised by manual end-to-end verification instead (documented in commit history), not unit tests — they're thin glue over already-tested logic, and a spawned interactive TTY session isn't a good unit-test target.

No build step exists or is needed: `cli/` is plain ESM `.mjs`, run directly via `node`; `extensions/*.ts` run through Pi's own `jiti` loader at launch time, not `tsc`.

## Structure

```
.
├── .env.sample                     # Template for provider API keys — copy to .env (gitignored)
├── .claude/commands/prime.md       # Claude Code slash command: onboard onto Pi's capabilities
├── package.json                    # name/version/engines/files for npm; commander/zod/chalk/
│                                    # @inquirer/prompts/yaml deps; bin: ohmypi; vitest devDep
├── LICENSE.md                      # MIT
├── AGENTS.md                       # This repo's own conventions, auto-loaded by Pi at startup
├── CLAUDE.md                       # Symlink to AGENTS.md — same content, read by Claude Code
├── jobs.json                       # Named presets: extensions, theme, mode, skills, contextFile.
│                                    # A project can add its own via <project>/.pi/ohmypi.jobs.json
├── context/                        # Markdown snippets referenced by a job's contextFile
├── damage-control-rules.yaml       # Canonical rules source, read directly by damage-control*.ts
│                                    # via an import.meta.url-relative path (see lib/theme-map.ts)
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
├── skills/                         # Agent Skills-standard: <name>/SKILL.md, discovered by ohmypi
│   └── using-ohmypi/SKILL.md        # How to use ohmypi/jobs.json — dogfoods this repo's own tooling
├── themes/                         # Theme JSON files (11 custom themes) — canonical source, reached
│                                     # only via per-extension registration or `ohmypi run --theme`
└── cli/                            # ohmypi — job-scoped extension/theme launcher (see below)
    ├── index.mjs                    # commander entry, bin target
    ├── lib/                          # discovery, settings I/O, jobs.json loading+validation,
    │                                  # conflict checking, the shared non-interactive input resolver
    │                                  # — each *.mjs here has a colocated *.test.mjs
    └── commands/                     # run.mjs, toggle.mjs, list.mjs, context.mjs
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

Only extensions carry real per-request cost — each registers tool schemas that sit in every request whether used or not, and some conflict when stacked (see `damage-control` below). Themes are pure JSON with zero context cost; skills are progressive-disclosure by Pi's own design (only name+description sit in context until loaded on demand). So job-scoped selection matters most for **extensions**; themes/skills ride along with a job as a convenience.

Current extensions (`extensions/`):

| File                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `damage-control.ts`          | Rule-based safety gate for the current project (`.pi/damage-control-rules.yaml`) — hard blocks and tells the agent to stop and ask the user                                                                                                                                                                                                                                                                              |
| `damage-control-continue.ts` | Same rules, but the block feedback lets the agent keep working past non-destructive violations                                                                                                                                                                                                                                                                                                                           |
| `theme-cycler.ts`            | F2/Ctrl+Q to cycle themes, `/theme` to pick one, status line + swatch widget                                                                                                                                                                                                                                                                                                                                             |
| `minimal.ts`                 | Replaces the footer with just model name + a 10-block context usage bar                                                                                                                                                                                                                                                                                                                                                  |
| `plan-mode/`                 | `/plan` or `Ctrl+Alt+P` toggles read-only exploration (disables `edit`/`write`, tokenizes/allowlists `bash`), owns a `plan_mode_question` clarifying-questions tool, extracts a numbered plan, tracks `[DONE:n]` progress during execution — base ported from Pi's own `examples/extensions/plan-mode/`, bash-safety + question-tool ported from [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions) |

`damage-control` and `damage-control-continue` are mutually exclusive — they hook the same events and would double-fire if both loaded. `ohmypi` refuses this combination with a hard error rather than silently picking one. A hard block with no human present to answer it just hangs an unattended/orchestrator-spawned agent forever — see `mode` below.

### `jobs.json` — named presets

```json
{
  "backend-fix": {
    "mode": "autonomous",
    "extensions": ["damage-control-continue", "minimal"],
    "theme": "nord",
    "skills": ["using-ohmypi"],
    "contextFile": "context/backend-fix.md"
  },
  "safe-explore": {
    "mode": "interactive",
    "extensions": ["damage-control", "plan-mode", "minimal"],
    "theme": "gruvbox",
    "skills": ["using-ohmypi"],
    "contextFile": "context/safe-explore.md"
  }
}
```

`ohmypi` validates this file at load time: every extension/theme/skill name must exist, no job may select two extensions from the same mutually-exclusive group, and a `"mode": "autonomous"` job may not select `damage-control` (only `damage-control-continue` — no human is there to answer a hard block). `mode` defaults to `"interactive"` if omitted. `skills`/`contextFile` are optional.

**Project-local custom presets.** A team can define their own named presets without touching this repo's `jobs.json` at all — drop a `.pi/ohmypi.jobs.json` in the *consuming* project, same shape as `jobs.json`. Every command that loads job presets (`run`, `toggle`, `list`, `context`) merges it in automatically just by being invoked from inside that project directory — a project-local preset overrides a base one with the same name, otherwise it's additive. Names still validate against oh-my-pi's own catalog (extensions/themes/skills) — a project-local preset composes what oh-my-pi ships, it doesn't invent new resource types. A community package installed via plain `pi install` (from [pi.dev/packages](https://pi.dev/packages)) layers in completely independently of any of this — `jobs.json` only manages oh-my-pi's own resources, everything else is just another entry in Pi's own `packages` array.

### `ohmypi run` — ephemeral, one session

```bash
ohmypi run backend-fix                          # launch pi with the job's extensions + theme
ohmypi run -e damage-control -e minimal          # ad hoc, no job needed
ohmypi run backend-fix -t dracula                # override the job's theme
ohmypi run backend-fix --dry-run                 # print the resolved plan as JSON, don't launch pi
ohmypi run backend-fix -- --print "fix the bug"  # everything after -- passes straight to pi
```

With no job/flags given in an interactive terminal, `ohmypi run` prompts you to pick a job. Called non-interactively (no TTY, no flags) it fails loudly instead of guessing — this is what lets an orchestrator (e.g. a cmux-style tool spinning up one `pi` per window) call it deterministically: `ohmypi run <job> --dry-run` returns the resolved extension/theme paths for the orchestrator to inspect, or `ohmypi run <job>` launches directly.

Every subcommand resolves input in the same order: **explicit flags → `--json '<str>'`/piped stdin → environment variable (`OHMYPI_RUN`, `OHMYPI_TOGGLE_SET`) → interactive prompt** (only reached when stdin is a TTY). `run` has no `--scope` — it only ever drives one ephemeral `pi` subprocess, so "scope" (persistent global/project state) doesn't apply.

### `ohmypi toggle` — persistent, global or project

```bash
ohmypi toggle                                          # interactive checkbox, global scope
ohmypi toggle --set minimal,theme-cycler               # non-interactive, full replacement list
echo '{"set":["minimal"]}' | ohmypi toggle             # same, via piped JSON
ohmypi toggle backend-fix                              # job-driven: syncs the job's extensions globally
ohmypi toggle backend-fix --scope project              # writes a git-package reference into .pi/settings.json
ohmypi toggle backend-fix --scope project -t dracula   # project scope, override the job's theme
ohmypi toggle backend-fix --scope project -s some-skill # project scope, add an extra skill on top of the job's own
ohmypi toggle backend-fix --scope project -t dracula --save-as my-preset # apply, and also save the result as a new preset
```

**Global scope** (default) writes **absolute** paths into the real `~/.pi/agent/settings.json`'s `extensions` array — the documented "additional paths via settings.json" mechanism (docs/extensions.md). This is the confirmed-working persistent mechanism; two alternatives were tried and reverted after failing an end-to-end check:

- **Relative paths in the `packages` array** — plausible from source, but empirically never loaded (no `[Extensions]` startup banner, no footer change).
- **A symlink into `~/.pi/agent/extensions/`** — every extension here imports `../lib/theme-map.ts`, and jiti (Pi's `.ts` loader) resolves relative imports via Node's classic CJS algorithm, which does not resolve a symlinked directory's realpath first, so that import failed.

Because `settings.json`'s `extensions` array holds absolute, machine-specific paths, re-run `ohmypi toggle` once after cloning this repo to a different path on a new machine.

**Project scope** (`--scope project`, run from inside the target project directory) writes a portable `git:` package reference instead — this repo publishes itself as a Pi package (see below), so the entry is teammate-portable, unlike absolute paths:

```json
{
  "packages": [
    {
      "source": "git:github.com/waynegibson/oh-my-pi@v0.1.0",
      "extensions": ["extensions/damage-control-continue.ts", "extensions/minimal.ts"],
      "skills": ["skills/using-ohmypi"],
      "themes": ["themes/nord.json"]
    }
  ]
}
```

`extensions`/`skills`/`themes` are always written as explicit arrays (`[]` when nothing was selected for that type), never omitted — Pi's package-filter semantics treat an *omitted* key as "load all of that type," so an omitted key here would silently pull in every theme/skill in the package instead of none. `skills`/`themes` only exist in project scope — global-scope `toggle` manages `extensions` only. A job's own `skills`/`theme` are the base selection; `-t`/`-s` (project scope only — global scope rejects them, since global has no theme/skill concept) layer ad hoc additions on top: `-t` overrides the job's theme, `-s` (repeatable) adds extra skills alongside the job's own, deduped. Both work with or without a job argument. Re-running with a different selection replaces the existing entry (matched by source, ignoring `@ref`) rather than duplicating it.

**Project-scoped extensions require project trust**, and Pi's non-interactive modes (`-p`, `--mode json`, `--mode rpc`) **silently skip untrusted project resources with no error** — `ohmypi toggle --scope project` prints a reminder after writing. Either run `pi` once interactively in that project and accept `/trust`, set `"defaultProjectTrust": "always"`, or pass `--approve`/`-a` for a single run. `ohmypi` never writes trust decisions on your behalf.

**`--save-as <name>`** captures whatever extensions/theme/skills were just resolved (job base + any `-t`/`-s`/`--set` layered on top) as a new named preset in `.pi/ohmypi.jobs.json` — additive to applying the selection, not a replacement for it. This is the fast path for "I hand-assembled a combination via flags and want to reuse it" without editing a jobs file by hand. The new preset is validated against oh-my-pi's own catalog before being written; an invalid preset throws and the file on disk is left untouched.

### `ohmypi context <job> [--global] [--remove]`

```bash
ohmypi context backend-fix              # print the job's contextFile to stdout
ohmypi context backend-fix >> AGENTS.md # paste it into a project's own AGENTS.md yourself
ohmypi context backend-fix --global     # idempotently write it into ~/.pi/agent/AGENTS.md
ohmypi context backend-fix --remove     # strip that job's block back out of ~/.pi/agent/AGENTS.md
```

`ohmypi` never writes into a *project's* `AGENTS.md`/`CLAUDE.md` automatically — those are almost always hand-authored by the project owner, and `ohmypi` has no way to know what's already there. The bare command always just prints to stdout; `--global` is the one place `ohmypi` manages a file directly, because `~/.pi/agent/AGENTS.md` is otherwise ohmypi's own space. Each job's block is wrapped in `<!-- ohmypi:<job>:start/end -->` markers so re-applying replaces only that job's section — everything else in the file is preserved. `--remove` is the inverse: it deletes that job's block (no-op with a message if it isn't there), leaving the rest of the file untouched.

### `ohmypi list [--json]`

Lists available job/extension/skill/theme names — the discovery step to call before `run`/`toggle`. `--json` emits `{"jobs":[...],"extensions":[...],"skills":[...],"themes":[...]}` for scripts/orchestrators.

### Skills (`skills/`)

Agent Skills-standard: `skills/<name>/SKILL.md` with `name`/`description` frontmatter. Unlike extensions, skills are near-zero cost to have around — Pi only keeps name+description in context until a skill is actually loaded — so there's no equivalent to `ohmypi toggle`'s global always-on list for skills; they travel with a job through project scope (above).

### Referencing this repo as a package

This repo needs no `pi` manifest — its `extensions/`, `skills/`, `themes/` directories already match Pi's convention-directory auto-discovery, so it's a valid package as-is. Anyone (including `ohmypi toggle --scope project`) can reference it directly:

```
git:github.com/waynegibson/oh-my-pi@v0.1.0
```

## Themes

Themes have zero context cost, so there's no need to scope them the way extensions are scoped — but they're also not blanket-discovered globally, to keep the startup `[Themes]` banner relevant to what's actually running. Each extension registers only what it needs via `lib/theme-map.ts`'s `registerThemeDiscovery()`, called once in every extension's factory body:

- Any extension **other than** `theme-cycler.ts` registers just its own `THEME_MAP`-assigned theme file (e.g. `plan-mode` → only `nord.json`) — the banner shows exactly what's relevant to what's actually running.
- `theme-cycler.ts` registers the whole `themes/` directory — cycling (`F2`/`Ctrl+Q`) or picking (`/theme`) needs the full set to mean anything. Stack it alongside anything else (`ohmypi run -e plan-mode -e theme-cycler -e minimal`) to get both the assigned theme _and_ the ability to override it.
- `ohmypi run --theme <name>` (or a job's `"theme"` field in `jobs.json`) is a third path: it passes `--theme <path>` straight to `pi`'s own CLI flag, independent of any extension's registration.

`~/.pi/agent/settings.json`'s own `"theme"` field should stay the built-in `"dark"`, not a custom theme — that field is Pi's own early-startup default, applied _before_ `resources_discover` fires, so a custom theme there errors and flash-falls-back the moment no extension happens to register it first. Each extension's own dynamic `ctx.ui.setTheme()` call 150ms later is what actually applies a custom theme.

One residual, harmless side effect: extensions with overlapping `THEME_MAP` assignments (`minimal.ts` and `theme-cycler.ts` both map to `synthwave`) produce a small theme-collision notice when stacked together — Pi resolves it correctly (keeps one, skips the duplicate copy), it's just startup noise, not a functional issue.

Run `/prime` in Claude Code inside this repo for a full onboarding guide to Pi's capabilities and this config's current state.

## Publishing (npm)

Not yet published — `package.json` has `"private": true` as a deliberate guard against an accidental `npm publish`. When ready:

1. Flip `"private": true` to `false` (or remove the field) in `package.json`.
2. `npm publish --access public` (the scope's `publishConfig.access` is already set to `"public"`, but pass the flag explicitly the first time).
3. `package.json`'s `files` array controls what actually ships in the tarball — `cli/`, `extensions/`, `lib/`, `skills/`, `themes/`, `context/`, `jobs.json`, `damage-control-rules.yaml`, `AGENTS.md`, `README.md`, `LICENSE.md`. Dev-only material (`.claude/`, tests, `.env.sample`) is excluded automatically.
4. Bump `version` and cut a matching git tag (`vX.Y.Z`) together — the git-package reference in this README and in any project's `.pi/settings.json` should track the same version.

## Security

- `auth.json`, `models.json`, `sessions/`, and the live `AGENTS.md` live only at `~/.pi/agent/` — outside this repo entirely, nothing to gitignore here.
- `.env` is gitignored — never commit real credentials.
- `auth.json` should only ever contain OAuth tokens (from `/login`) or `$ENV_VAR` references — no literal API keys belong anywhere in this setup.

## License

[MIT](LICENSE.md) © Wayne Gibson
