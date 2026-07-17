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

/**
 * Pure builder for a project-scope package entry: merges a job's own extensions/skills/
 * theme with ad hoc additions (extra skills, a theme override) from CLI flags. Extension
 * selection is always explicit ([] when empty, never omitted) — Pi's package-filter
 * semantics treat an omitted key as "load all of that type," so an omitted key here
 * would silently pull in every theme/skill in the package instead of none.
 *
 * @param {string} source - e.g. "git:github.com/waynegibson/oh-my-pi@v0.1.0"
 * @param {string[]} extensionRelPaths - repo-relative paths, already resolved
 * @param {{skills?: string[], theme?: string}} [jobDef] - the job's own fields, if any
 * @param {{adHocSkills?: string[], adHocTheme?: string}} [adHoc]
 * @param {{name: string, path: string}[]} skillCandidates - from discoverSkills()
 * @param {{name: string, path: string}[]} themeCandidates - from discoverThemes()
 * @param {(absPath: string) => string} toRepoRelativeFn
 */
export function buildProjectPackageEntry(
  source,
  extensionRelPaths,
  jobDef = {},
  adHoc = {},
  skillCandidates = [],
  themeCandidates = [],
  toRepoRelativeFn,
) {
  const { adHocSkills = [], adHocTheme } = adHoc;

  const entry = {
    source,
    extensions: extensionRelPaths,
    skills: [],
    themes: [],
  };

  const skillNames = [...new Set([...(jobDef.skills ?? []), ...adHocSkills])];
  if (skillNames.length > 0) {
    const skillByName = new Map(skillCandidates.map((c) => [c.name, c]));
    entry.skills = skillNames.map((name) => {
      const c = skillByName.get(name);
      if (!c) {
        throw new Error(`unknown skill "${name}" — valid: ${skillCandidates.map((c) => c.name).join(", ")}`);
      }
      return toRepoRelativeFn(c.path);
    });
  }

  const themeName = adHocTheme ?? jobDef.theme;
  if (themeName) {
    const theme = themeCandidates.find((c) => c.name === themeName);
    if (!theme) {
      throw new Error(`unknown theme "${themeName}" — valid: ${themeCandidates.map((c) => c.name).join(", ")}`);
    }
    entry.themes = [toRepoRelativeFn(theme.path)];
  }

  return entry;
}
