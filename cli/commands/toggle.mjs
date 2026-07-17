import { join } from "node:path";
import { checkbox, select } from "@inquirer/prompts";
import chalk from "chalk";
import { discoverExtensions, discoverSkills, discoverThemes } from "../lib/discover.mjs";
import { readSettings, writeSettings } from "../lib/settings.mjs";
import {
  buildProjectPackageEntry,
  projectSettingsPath,
  readProjectSettings,
  upsertPackageEntry,
  writeProjectSettings,
} from "../lib/project-settings.mjs";
import { toRepoRelative } from "../lib/repo-relative.mjs";
import { PACKAGE_REF, PACKAGE_SOURCE_BASE, REPO_ROOT } from "../lib/paths.mjs";
import { findConflict, MUTUALLY_EXCLUSIVE_GROUPS } from "../lib/conflicts.mjs";
import { resolveInput } from "../lib/resolve-input.mjs";
import { ToggleJsonInputSchema } from "../lib/schemas.mjs";
import { loadJobs } from "../lib/jobs.mjs";

const BACK_TO_SELECTION = Symbol("back-to-selection");
const NEITHER = Symbol("neither");

function splitNames(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function collect(value, previous) {
  return previous.concat([value]);
}

export function registerToggle(program) {
  program
    .command("toggle")
    .description("Set which extensions load persistently — globally or committed to a project")
    .argument("[job]", "job name from jobs.json — its extensions/skills/theme become the base selection")
    .option("--set <names>", "comma-separated extension names — full replacement list, non-interactive", splitNames)
    .option("--json <json>", 'JSON input: {"set":["ext-a","ext-b"]}')
    .option("--scope <scope>", "global (~/.pi/agent/settings.json, default) or project (.pi/settings.json in cwd)", "global")
    .option("-t, --theme <name>", "theme name — project scope only, overrides the job's theme")
    .option("-s, --skill <name>", "skill name to add — project scope only, additive to a job's skills (repeatable)", collect, [])
    .action(async (job, opts) => {
      if (opts.scope !== "global" && opts.scope !== "project") {
        throw new Error(`invalid --scope "${opts.scope}" — must be "global" or "project"`);
      }
      if (opts.scope === "global" && (opts.theme !== undefined || opts.skill.length > 0)) {
        throw new Error(
          "--theme/--skill only apply to --scope project — global scope manages extensions only (settings.json's extensions array)",
        );
      }

      const candidates = discoverExtensions();
      const candidatesByName = new Map(candidates.map((c) => [c.name, c]));

      let jobDef;
      if (job !== undefined) {
        const jobs = loadJobs();
        jobDef = jobs[job];
        if (!jobDef) {
          throw new Error(`unknown job "${job}" — run \`ohmypi list\` to see available jobs`);
        }
      }

      const flagsValue =
        job !== undefined || opts.set !== undefined
          ? [...new Set([...(jobDef?.extensions ?? []), ...(opts.set ?? [])])]
          : undefined;

      const cwd = process.cwd();
      const currentPaths =
        opts.scope === "project" ? currentProjectExtensionPaths(cwd) : currentGlobalExtensionPaths();

      const { value } = await resolveInput({
        flagsValue,
        jsonFlag: opts.json,
        jsonSchema: ToggleJsonInputSchema,
        envVarName: "OHMYPI_TOGGLE_SET",
        interactive: () => interactiveToggle(candidates, candidatesByName, currentPaths),
      });

      const names = Array.isArray(value) ? value : value.set;

      const conflict = findConflict(names);
      if (conflict) {
        throw new Error(
          `mutually-exclusive extensions selected: ${conflict.conflicting.join(", ")} (group: ${conflict.group.join("/")})`,
        );
      }

      const paths = names.map((name) => {
        const c = candidatesByName.get(name);
        if (!c) {
          throw new Error(`unknown extension "${name}" — valid: ${candidates.map((c) => c.name).join(", ")}`);
        }
        return c.path;
      });

      if (opts.scope === "project") {
        applyProjectSelection(cwd, paths, jobDef, { adHocSkills: opts.skill, adHocTheme: opts.theme });
      } else {
        applySelection(candidates, paths);
      }
    });
}

function currentGlobalExtensionPaths() {
  const settings = readSettings();
  return Array.isArray(settings.extensions) ? settings.extensions : [];
}

function currentProjectExtensionPaths(cwd) {
  const settings = readProjectSettings(cwd);
  const packages = Array.isArray(settings.packages) ? settings.packages : [];
  const entry = packages.find(
    (p) => typeof p === "object" && p !== null && typeof p.source === "string" && p.source.startsWith(PACKAGE_SOURCE_BASE),
  );
  if (!entry || !Array.isArray(entry.extensions)) return [];
  return entry.extensions.map((rel) => join(REPO_ROOT, rel));
}

async function interactiveToggle(candidates, candidatesByName, currentPaths) {
  const candidatePaths = new Set(candidates.map((c) => c.path));
  let checkedByDefault = currentPaths.filter((p) => candidatePaths.has(p));

  let selectedPaths;
  while (true) {
    const rawSelected = await checkbox({
      message: "Select extensions to always load (space to toggle, a to select all, i to invert, enter to confirm):",
      choices: candidates.map((c) => ({
        name: c.name,
        value: c.path,
        checked: checkedByDefault.includes(c.path),
      })),
    });

    const resolution = await resolveConflictsInteractive(rawSelected, candidatesByName);
    if (resolution === BACK_TO_SELECTION) {
      checkedByDefault = rawSelected;
      continue;
    }
    selectedPaths = resolution;
    break;
  }

  const pathToName = new Map(candidates.map((c) => [c.path, c.name]));
  return { set: selectedPaths.map((p) => pathToName.get(p)) };
}

async function resolveConflictsInteractive(selectedPaths, candidatesByName) {
  let resolved = selectedPaths;
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const groupPaths = group.map((name) => candidatesByName.get(name)?.path).filter(Boolean);
    const selectedInGroup = groupPaths.filter((p) => resolved.includes(p));
    if (selectedInGroup.length <= 1) continue;

    const selectedNames = group.filter((name) => selectedInGroup.includes(candidatesByName.get(name)?.path));
    const keep = await select({
      message: `${selectedNames.join(" and ")} conflict (same events, would double-fire) — pick one to keep:`,
      choices: [
        ...selectedNames.map((name) => ({ name: `Keep ${name}`, value: candidatesByName.get(name).path })),
        { name: "Neither — drop both and continue", value: NEITHER },
        { name: "Go back and reselect", value: BACK_TO_SELECTION },
      ],
    });
    if (keep === BACK_TO_SELECTION) return BACK_TO_SELECTION;
    if (keep === NEITHER) {
      resolved = resolved.filter((p) => !selectedInGroup.includes(p));
      continue;
    }
    resolved = resolved.filter((p) => !selectedInGroup.includes(p) || p === keep);
  }
  return resolved;
}

function applySelection(candidates, selectedPaths) {
  const settings = readSettings();
  const currentExtensions = Array.isArray(settings.extensions) ? settings.extensions : [];
  const candidatePaths = new Set(candidates.map((c) => c.path));
  const untouched = currentExtensions.filter((p) => !candidatePaths.has(p));

  settings.extensions = [...untouched, ...selectedPaths];
  writeSettings(settings);

  const selectedSet = new Set(selectedPaths);
  const added = candidates.filter((c) => selectedSet.has(c.path) && !currentExtensions.includes(c.path));
  const removed = candidates.filter((c) => !selectedSet.has(c.path) && currentExtensions.includes(c.path));

  if (added.length > 0) console.log(chalk.green(`Added to global extensions: ${added.map((c) => c.name).join(", ")}`));
  if (removed.length > 0) console.log(chalk.red(`Removed from global extensions: ${removed.map((c) => c.name).join(", ")}`));
  if (added.length === 0 && removed.length === 0) console.log("No changes.");
}

function applyProjectSelection(cwd, selectedPaths, jobDef, adHoc = {}) {
  const entry = buildProjectPackageEntry(
    `${PACKAGE_SOURCE_BASE}@${PACKAGE_REF}`,
    selectedPaths.map((p) => toRepoRelative(p)),
    jobDef,
    adHoc,
    discoverSkills(),
    discoverThemes(),
    toRepoRelative,
  );

  const settings = readProjectSettings(cwd);
  const updated = upsertPackageEntry(settings, entry);
  writeProjectSettings(cwd, updated);

  console.log(chalk.green(`Wrote project package entry to ${projectSettingsPath(cwd)}`));
  console.log(
    chalk.yellow(
      "Reminder: project-scoped extensions require project trust. Non-interactive `pi` runs " +
        "(-p / --mode json / --mode rpc) silently skip untrusted project resources with no error. " +
        "Run `pi` once interactively in this project and accept /trust, or set " +
        '"defaultProjectTrust": "always" in settings, or pass --approve/-a for a single run. ' +
        "ohmypi does not write trust decisions on your behalf.",
    ),
  );
}
