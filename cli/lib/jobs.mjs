import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JOBS_PATH, REPO_ROOT } from "./paths.mjs";
import { JobsFileSchema } from "./schemas.mjs";
import { discoverExtensions, discoverSkills, discoverThemes } from "./discover.mjs";
import { findConflict } from "./conflicts.mjs";

/**
 * Load and validate jobs.json: schema shape via Zod, then a semantic pass Zod alone
 * can't do — every referenced extension/theme/skill name must exist, no job may select
 * two extensions from the same mutually-exclusive group, and an "autonomous" job may not
 * select the hard-block damage-control variant (nothing would be there to answer it).
 * Throws a plain Error naming the job and the specific bad reference; callers let it
 * bubble to the top-level try/catch (stderr + exit 1) rather than partially loading.
 */
export function loadJobs() {
  const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
  const parsed = JobsFileSchema.parse(raw);

  const extNames = new Set(discoverExtensions().map((c) => c.name));
  const themeNames = new Set(discoverThemes().map((c) => c.name));
  const skillNames = new Set(discoverSkills().map((c) => c.name));

  for (const [jobName, def] of Object.entries(parsed)) {
    for (const ext of def.extensions) {
      if (!extNames.has(ext)) {
        throw new Error(`jobs.json: job "${jobName}" references unknown extension "${ext}"`);
      }
    }
    if (def.theme && !themeNames.has(def.theme)) {
      throw new Error(`jobs.json: job "${jobName}" references unknown theme "${def.theme}"`);
    }
    for (const skill of def.skills) {
      if (!skillNames.has(skill)) {
        throw new Error(`jobs.json: job "${jobName}" references unknown skill "${skill}"`);
      }
    }
    if (def.contextFile && !existsSync(join(REPO_ROOT, def.contextFile))) {
      throw new Error(`jobs.json: job "${jobName}" references missing contextFile "${def.contextFile}"`);
    }
    const conflict = findConflict(def.extensions);
    if (conflict) {
      throw new Error(
        `jobs.json: job "${jobName}" selects mutually-exclusive extensions ${conflict.conflicting.join(", ")} (group: ${conflict.group.join("/")})`,
      );
    }
    if (def.mode === "autonomous" && def.extensions.includes("damage-control")) {
      throw new Error(
        `jobs.json: job "${jobName}" is mode "autonomous" but selects "damage-control" ` +
          `(hard-block, hangs with no human to answer) — use "damage-control-continue" instead`,
      );
    }
  }

  return parsed;
}
