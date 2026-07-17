import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
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
 */
export function discoverExtensions() {
  const entries = readdirSync(EXT_DIR, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      candidates.push({ name: entry.name.slice(0, -3), path: join(EXT_DIR, entry.name) });
    } else if (entry.isDirectory()) {
      const indexPath = join(EXT_DIR, entry.name, "index.ts");
      if (statSyncSafe(indexPath)) {
        candidates.push({ name: entry.name, path: join(EXT_DIR, entry.name) });
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

/** Discover skill candidates: `<name>/SKILL.md` directories in skills/. Returns [] if
 *  skills/ doesn't exist yet (no skills defined in this repo is a valid state). */
export function discoverSkills() {
  let entries;
  try {
    entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const candidates = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillMd = join(SKILLS_DIR, entry.name, "SKILL.md");
      if (statSyncSafe(skillMd)) {
        candidates.push({ name: entry.name, path: join(SKILLS_DIR, entry.name) });
      }
    }
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}
