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
 * theme with ad hoc additions (extra skills, exclusions, a theme override) from CLI flags.
 *
 * `extensions`/`themes` are always explicit ([] when empty, never omitted) — Pi's
 * package-filter semantics treat an omitted key as "load all of that type," which is the
 * wrong default for these: extensions carry real runtime cost, and only one theme applies
 * at a time. `skills` inverts this deliberately: Pi keeps only name+description of an
 * unloaded skill in context (near-zero cost), so the default is "all of them," with
 * `excludeSkills`/adHoc exclusions as the opt-out — an explicit include list (skills/
 * adHocSkills) still wins when given, same as before.
 *
 * @param {string} source - e.g. "git:github.com/waynegibson/oh-my-pi@v0.1.0-alpha.1"
 * @param {string[]} extensionRelPaths - repo-relative paths, already resolved
 * @param {{skills?: string[], excludeSkills?: string[], theme?: string}} [jobDef] - the job's own fields, if any
 * @param {{adHocSkills?: string[], adHocExcludeSkills?: string[], adHocTheme?: string}} [adHoc]
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
  const { adHocSkills = [], adHocExcludeSkills = [], adHocTheme } = adHoc;

  const entry = {
    source,
    extensions: extensionRelPaths,
    themes: [],
  };

  const skillByName = new Map(skillCandidates.map((c) => [c.name, c]));
  const resolveSkillPath = (name) => {
    const c = skillByName.get(name);
    if (!c) {
      throw new Error(`unknown skill "${name}" — valid: ${skillCandidates.map((c) => c.name).join(", ")}`);
    }
    return toRepoRelativeFn(c.path);
  };

  const includeNames = [...new Set([...(jobDef.skills ?? []), ...adHocSkills])];
  const excludeNames = [...new Set([...(jobDef.excludeSkills ?? []), ...adHocExcludeSkills])];

  if (includeNames.length > 0 && excludeNames.length > 0) {
    throw new Error(
      'skill selection is contradictory: "skills"/-s (only these load) and "excludeSkills"/-x ' +
        "(everything except these loads) can't both be set — pick one",
    );
  }

  if (includeNames.length > 0) {
    entry.skills = includeNames.map(resolveSkillPath);
  } else if (excludeNames.length > 0) {
    entry.skills = ["skills/**", ...excludeNames.map((name) => `!${resolveSkillPath(name)}`)];
  }
  // else: leave `skills` unset — omitted means "load all" under Pi's own filter semantics.

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
