## Working mode: backend-fix (autonomous)

- No human is watching this session — `damage-control-continue` is loaded, not the
  hard-block variant, so non-destructive blocks (e.g. reading `.env` to check a key exists)
  should be treated as "assume it's fine, move on," not "stop and ask."
- Destructive actions (delete, overwrite, force-push, drop, `rm`, truncate, `sudo`) still
  stop and report — don't invent a workaround that achieves the same destructive effect.
- Prefer the smallest fix that resolves the reported bug. Don't refactor unrelated code.
- Run the project's existing lint/test commands before considering the task done.
