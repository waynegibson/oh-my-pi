import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { JOBS_PATH, REPO_ROOT } from "./paths.mjs";
import { JobDefSchema, JobsFileSchema } from "./schemas.mjs";
import { discoverExtensions, discoverSkills, discoverThemes } from "./discover.mjs";
import { findConflict } from "./conflicts.mjs";

/** Where a project can define its own named presets without touching this repo. */
export function projectJobsPath(cwd) {
  return join(cwd, ".pi", "ohmypi.jobs.json");
}

/**
 * Parse and semantically validate a single jobs file: schema shape via Zod, then a
 * pass Zod alone can't do — every referenced extension/theme/skill name must exist in
 * oh-my-pi's own catalog (project-local presets still only compose oh-my-pi's own
 * resources, not arbitrary community packages — those layer in independently via plain
 * `pi install`, entirely outside jobs.json), no job may select two extensions from the
 * same mutually-exclusive group, and an "autonomous" job may not select the hard-block
 * damage-control variant (nothing would be there to answer it). Throws a plain Error
 * naming the source file, the job, and the specific bad reference.
 */
function validateJobDef(jobName, def, sourceLabel) {
  const extNames = new Set(discoverExtensions().map((c) => c.name));
  const themeNames = new Set(discoverThemes().map((c) => c.name));
  const skillNames = new Set(discoverSkills().map((c) => c.name));

  for (const ext of def.extensions) {
    if (!extNames.has(ext)) {
      throw new Error(`${sourceLabel}: job "${jobName}" references unknown extension "${ext}"`);
    }
  }
  if (def.theme && !themeNames.has(def.theme)) {
    throw new Error(`${sourceLabel}: job "${jobName}" references unknown theme "${def.theme}"`);
  }
  for (const skill of def.skills) {
    if (!skillNames.has(skill)) {
      throw new Error(`${sourceLabel}: job "${jobName}" references unknown skill "${skill}"`);
    }
  }
  if (def.contextFile && !existsSync(join(REPO_ROOT, def.contextFile))) {
    throw new Error(`${sourceLabel}: job "${jobName}" references missing contextFile "${def.contextFile}"`);
  }
  const conflict = findConflict(def.extensions);
  if (conflict) {
    throw new Error(
      `${sourceLabel}: job "${jobName}" selects mutually-exclusive extensions ${conflict.conflicting.join(", ")} (group: ${conflict.group.join("/")})`,
    );
  }
  if (def.mode === "autonomous" && def.extensions.includes("damage-control")) {
    throw new Error(
      `${sourceLabel}: job "${jobName}" is mode "autonomous" but selects "damage-control" ` +
        `(hard-block, hangs with no human to answer) — use "damage-control-continue" instead`,
    );
  }
}

/**
 * Parse and semantically validate a single jobs file: schema shape via Zod, then a
 * pass Zod alone can't do — every referenced extension/theme/skill name must exist in
 * oh-my-pi's own catalog (project-local presets still only compose oh-my-pi's own
 * resources, not arbitrary community packages — those layer in independently via plain
 * `pi install`, entirely outside jobs.json), no job may select two extensions from the
 * same mutually-exclusive group, and an "autonomous" job may not select the hard-block
 * damage-control variant (nothing would be there to answer it). Throws a plain Error
 * naming the source file, the job, and the specific bad reference.
 */
function loadAndValidateJobsFile(path, sourceLabel) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const parsed = JobsFileSchema.parse(raw);

  for (const [jobName, def] of Object.entries(parsed)) {
    validateJobDef(jobName, def, sourceLabel);
  }

  return parsed;
}

/**
 * Load and validate job presets: this repo's own jobs.json, merged with an optional
 * project-local jobs file (<cwd>/.pi/ohmypi.jobs.json) if one exists — so a team can
 * define their own named presets without needing write access to (or coupling every
 * project to) oh-my-pi's own jobs.json. Project entries override base entries by name
 * on collision; otherwise additive. Every command that calls loadJobs() picks this up
 * automatically just by being invoked from inside that project directory.
 *
 * @param {string} [jobsPath] - defaults to the repo's real jobs.json; overridable for tests.
 * @param {string} [cwd] - defaults to process.cwd(); overridable for tests.
 */
export function loadJobs(jobsPath = JOBS_PATH, cwd = process.cwd()) {
  const base = loadAndValidateJobsFile(jobsPath, "jobs.json");

  const projectPath = projectJobsPath(cwd);
  if (!existsSync(projectPath)) {
    return base;
  }

  const project = loadAndValidateJobsFile(projectPath, "project jobs (.pi/ohmypi.jobs.json)");
  return { ...base, ...project };
}

/** Raw (unvalidated) contents of a project's local jobs file, or {} if none exists yet. */
function readRawProjectJobs(cwd) {
  const p = projectJobsPath(cwd);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Save a resolved job definition into a project's local jobs file, so an ad hoc selection
 * built via `toggle`'s flags can become a reusable preset without touching this repo's own
 * jobs.json. Overwrites any existing entry with the same name. Validated *before* writing —
 * an invalid preset throws and the file on disk is left untouched, rather than persisting a
 * broken entry that would fail every subsequent `ohmypi` invocation in this project.
 */
export function writeProjectJob(cwd, name, jobDef) {
  const sourceLabel = "project jobs (.pi/ohmypi.jobs.json)";
  const parsed = JobDefSchema.parse(jobDef);
  validateJobDef(name, parsed, sourceLabel);

  const p = projectJobsPath(cwd);
  const updated = { ...readRawProjectJobs(cwd), [name]: parsed };
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(updated, null, 2)}\n`);
  return p;
}
