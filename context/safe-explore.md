## Working mode: safe-explore (interactive)

- `damage-control` (hard-block) is loaded — every rule violation stops and asks. That's
  intentional here: this mode is for exploring unfamiliar or sensitive parts of a codebase
  with a human present to answer.
- `plan-mode` is also loaded — read-only exploration by default (`edit`/`write` disabled).
  Use `/plan` or `Ctrl+Alt+P` to toggle into normal mode once a plan is agreed.
- Ask clarifying questions early rather than guessing at intent.
