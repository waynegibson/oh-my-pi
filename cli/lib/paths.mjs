import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so ohmypi finds the repo
// correctly regardless of which directory it's invoked from (e.g. via `npm link`).
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXT_DIR = join(REPO_ROOT, "extensions");
export const THEMES_DIR = join(REPO_ROOT, "themes");
export const JOBS_PATH = join(REPO_ROOT, "jobs.json");
export const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");
