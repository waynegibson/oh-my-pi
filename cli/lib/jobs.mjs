import { readFileSync } from "node:fs";
import { JOBS_PATH } from "./paths.mjs";
import { JobsFileSchema } from "./schemas.mjs";
import { discoverExtensions, discoverThemes } from "./discover.mjs";
import { findConflict } from "./conflicts.mjs";

/**
 * Load and validate jobs.json: schema shape via Zod, then a semantic pass Zod alone
 * can't do — every referenced extension/theme name must exist, and no job may select
 * two extensions from the same mutually-exclusive group. Throws a plain Error naming
 * the job and the specific bad reference; callers let it bubble to the top-level
 * try/catch (stderr + exit 1) rather than partially loading.
 */
export function loadJobs() {
  const raw = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
  const parsed = JobsFileSchema.parse(raw);

  const extNames = new Set(discoverExtensions().map((c) => c.name));
  const themeNames = new Set(discoverThemes().map((c) => c.name));

  for (const [jobName, def] of Object.entries(parsed)) {
    for (const ext of def.extensions) {
      if (!extNames.has(ext)) {
        throw new Error(`jobs.json: job "${jobName}" references unknown extension "${ext}"`);
      }
    }
    if (def.theme && !themeNames.has(def.theme)) {
      throw new Error(`jobs.json: job "${jobName}" references unknown theme "${def.theme}"`);
    }
    const conflict = findConflict(def.extensions);
    if (conflict) {
      throw new Error(
        `jobs.json: job "${jobName}" selects mutually-exclusive extensions ${conflict.conflicting.join(", ")} (group: ${conflict.group.join("/")})`,
      );
    }
  }

  return parsed;
}
