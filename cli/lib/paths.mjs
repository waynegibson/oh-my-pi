import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so ohmypi finds the repo
// correctly regardless of which directory it's invoked from (e.g. via `npm link`).
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXT_DIR = join(REPO_ROOT, "extensions");
export const THEMES_DIR = join(REPO_ROOT, "themes");
export const SKILLS_DIR = join(REPO_ROOT, "skills");
export const JOBS_PATH = join(REPO_ROOT, "jobs.json");
export const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");
export const GLOBAL_AGENTS_MD_PATH = join(homedir(), ".pi", "agent", "AGENTS.md");

// Pinned release ref this repo publishes itself as a Pi package under. Bumping the
// released version is a one-line change here, paired with actually cutting a new tag.
export const PACKAGE_SOURCE_BASE = "git:github.com/waynegibson/oh-my-pi";
export const PACKAGE_REF = "v0.1.0";
