import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { EXT_DIR, SKILLS_DIR, THEMES_DIR } from "./paths.mjs";

function statSyncSafe(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

/**
 * Discover extension candidates: flat `<name>.ts` files, or `<name>/index.ts`
 * folder-style extensions. Ported from the original toggle-extensions.mjs logic.
 *
 * `path` is the directory for folder-style extensions — correct for `-e <path>`/absolute
 * `settings.json` `extensions` entries, which resolve a directory's `index.ts` themselves.
 * `entryPath` is always the actual loadable file (same as `path` for flat extensions,
 * `<path>/index.ts` for folder-style ones) — required for Pi's package-filter matching,
 * which compares filter patterns against the resolved entry file with no directory-level
 * fallback for extensions (unlike skills, where `SKILL.md`'s parent directory is matched too).
 */
export function discoverExtensions() {
  const entries = readdirSync(EXT_DIR, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      const path = join(EXT_DIR, entry.name);
      candidates.push({ name: entry.name.slice(0, -3), path, entryPath: path });
    } else if (entry.isDirectory()) {
      const indexPath = join(EXT_DIR, entry.name, "index.ts");
      if (statSyncSafe(indexPath)) {
        candidates.push({ name: entry.name, path: join(EXT_DIR, entry.name), entryPath: indexPath });
      }
    }
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

/** Discover theme candidates: flat `<name>.json` files in themes/. */
export function discoverThemes() {
  const entries = readdirSync(THEMES_DIR, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (entry.isFile() && extname(entry.name) === ".json") {
      candidates.push({ name: entry.name.slice(0, -".json".length), path: join(THEMES_DIR, entry.name) });
    }
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Discover skill candidates: any directory under skills/ that directly contains a
 * SKILL.md, at any nesting depth (e.g. `skills/productivity/using-ohmypi/`) — mirrors
 * Pi's own recursive skill collection exactly: a directory with SKILL.md is a skill and
 * isn't recursed into further; otherwise its subdirectories are searched. `name` is the
 * skill's own leaf directory name, not its category path. Returns [] if skills/ doesn't
 * exist yet (no skills defined in this repo is a valid state).
 */
export function discoverSkills() {
  const candidates = [];
  walkSkillDirs(SKILLS_DIR, candidates);
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

function walkSkillDirs(dir, candidates) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (statSyncSafe(join(dir, "SKILL.md"))) {
    candidates.push({ name: basename(dir), path: dir });
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      walkSkillDirs(join(dir, entry.name), candidates);
    }
  }
}
