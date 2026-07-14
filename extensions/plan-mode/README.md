# Plan Mode Extension

Read-only exploration mode for safe code analysis.

Ported from Pi's own `examples/extensions/plan-mode/`. The bash-safety tokenizer
(`tool-policy.ts`) and the dedicated clarifying-questions tool (`question-tool.ts`) were
in turn ported from [narumiruna/pi-extensions](https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-plan-mode),
replacing the original's regex-based bash check and its dependency on an external,
unowned `"questionnaire"` tool.

## Files

- `index.ts` — extension entry: commands, shortcut, tool-set switching, session persistence
- `utils.ts` — plan-step extraction/completion tracking, fail-closed session-state restore
- `tool-policy.ts` — bash command safety (real tokenizer: quote/escape-aware, rejects
  redirects/subshells/substitution/backgrounding, per-command flag denylists)
- `question-tool.ts` — the `plan_mode_question` tool (owned schema + UI flow)

## Features

- **Built-in write tools disabled**: Disables edit/write while preserving other active tools
- **Bash safety**: Commands are tokenized and checked against a read-only allowlist plus
  per-command dangerous-flag denylists — not just a raw-string regex match
- **Clarifying questions**: `plan_mode_question` lets the agent ask up to 3 structured
  decision questions with 2-4 options each, presented via a select UI (with a free-form fallback)
- **Plan extraction**: Extracts numbered steps from `Plan:` sections
- **Progress tracking**: Widget shows completion status during execution
- **[DONE:n] markers**: Explicit step completion tracking
- **Session persistence**: State survives session resume, restored fail-closed (a
  corrupted/hand-edited entry falls back to safe per-field defaults instead of a blind cast)

## Commands

- `/plan` - Toggle plan mode
- `/todos` - Show current plan progress
- `Ctrl+Alt+P` - Toggle plan mode (shortcut)

## Usage

1. Enable plan mode with `/plan` or `--plan` flag
2. Ask the agent to analyze code and create a plan
3. The agent should output a numbered plan under a `Plan:` header:

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. Choose "Execute the plan" when prompted
5. During execution, the agent marks steps complete with `[DONE:n]` tags
6. Progress widget shows completion status

## How It Works

### Plan Mode (Read-Only)
- Built-in edit/write tools disabled
- Other active tools remain available
- Bash commands filtered through allowlist
- Agent creates a plan without making changes

### Execution Mode
- Full tool access restored
- Agent executes steps in order
- `[DONE:n]` markers track completion
- Widget shows progress

### Command Safety (`tool-policy.ts`)

The command is tokenized first (quote/escape-aware), split on real shell separators
(`;`, `|`, `&&`). Redirects (`>`, `<`), subshells (`(`, `)`), command substitution
(`$(...)`, `${...}`), inline env assignment, and backgrounding (bare `&`) are rejected
outright, regardless of which binary is used.

Unconditionally safe binaries (no subcommand/flag restrictions beyond the shared
dangerous-flag denylist below): `cat`, `head`, `tail`, `grep`, `find`, `ls`, `pwd`, `echo`,
`printf`, `wc`, `sort`, `uniq`, `diff`, `file`, `stat`, `du`, `df`, `tree`, `which`,
`whereis`, `type`, `printenv`, `uname`, `whoami`, `id`, `date`, `uptime`, `ps`, `jq`, `rg`,
`fd`, `bat`, `eza`.

Structurally validated (specific subcommands/args only, everything else on that binary is blocked):
- `git` — only `status`, `log`, `diff`, `show`, `branch` (no args), `remote show`/`remote get-url`, `ls-files`, `grep` (without `-O`)
- `npm` — `list`/`ls`/`view`/`info`/`search`/`outdated`/`audit`/`test`, or `run test`/`check`/`typecheck`/`lint`
- `sed` — only `-n '<n>[,<n>]p'` (print-range, no in-place edit)
- `tsc` — only with `--noEmit`
- `node`/`python`/`python3`/`biome`/`ruff`/`ty` — only `--version`
- `cargo`/`go`/`pytest`/`vitest`/`jest` — only `test`/`check`

Blocked outright (mutating commands, checked before any subcommand logic):
`rm`, `rmdir`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, `chown`, `chgrp`, `ln`, `tee`,
`truncate`, `dd`, `sudo`, `su`, `kill`, `pkill`, `killall`, `reboot`, `shutdown`, and
editors (`vim`, `nano`, `emacs`, `code`, `subl`).

Also blocked via per-command flag denylists even on otherwise-safe binaries: `sed -i`,
`find -exec`/`-execdir`/`-ok`, `date -s`/`--set`, `sort -o`/`-T`, `diff --output`,
`git grep -O`, `fd --exec`, `rg --pre`, `bat --pager`, and the shared `-i`/`--in-place`/
`--fix`/`--write`/`--delete` flags on any command.
