import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function projectSettingsPath(cwd) {
  return join(cwd, ".pi", "settings.json");
}

export function readProjectSettings(cwd) {
  const p = projectSettingsPath(cwd);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

export function writeProjectSettings(cwd, settings) {
  const p = projectSettingsPath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(settings, null, 2)}\n`);
}

/** Identity for package dedup: the source string with any trailing "@ref" stripped.
 *  Safe via lastIndexOf("@") — host/user/repo in a git: source never contain "@". */
function sourceIdentity(source) {
  const at = source.lastIndexOf("@");
  return at === -1 ? source : source.slice(0, at);
}

/**
 * Merge a package entry into settings.packages by source identity: an existing entry
 * with the same identity has its filter fields replaced (not duplicated); otherwise the
 * entry is appended.
 */
export function upsertPackageEntry(settings, entry) {
  const packages = Array.isArray(settings.packages) ? [...settings.packages] : [];
  const identity = sourceIdentity(entry.source);
  const idx = packages.findIndex((p) => typeof p === "object" && p !== null && sourceIdentity(p.source) === identity);
  if (idx === -1) {
    packages.push(entry);
  } else {
    packages[idx] = { ...packages[idx], ...entry };
  }
  return { ...settings, packages };
}
