import { relative, sep } from "node:path";
import { REPO_ROOT } from "./paths.mjs";

/**
 * Convert an absolute path under REPO_ROOT to a forward-slash repo-relative path
 * (e.g. "extensions/damage-control-continue.ts", "skills/using-ohmypi") — the form
 * Pi's package filter arrays expect, distinct from the absolute-path contract
 * discover.mjs's candidates use for run/global-toggle.
 */
export function toRepoRelative(absPath) {
  return relative(REPO_ROOT, absPath).split(sep).join("/");
}
