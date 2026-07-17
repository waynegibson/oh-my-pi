import { checkbox, select } from "@inquirer/prompts";
import chalk from "chalk";
import { discoverExtensions } from "../lib/discover.mjs";
import { readSettings, writeSettings } from "../lib/settings.mjs";
import { findConflict, MUTUALLY_EXCLUSIVE_GROUPS } from "../lib/conflicts.mjs";
import { resolveInput } from "../lib/resolve-input.mjs";
import { ToggleJsonInputSchema } from "../lib/schemas.mjs";

const BACK_TO_SELECTION = Symbol("back-to-selection");
const NEITHER = Symbol("neither");

function splitNames(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function registerToggle(program) {
  program
    .command("toggle")
    .description("Set which extensions always load globally (writes ~/.pi/agent/settings.json)")
    .option("--set <names>", "comma-separated extension names — full replacement list, non-interactive", splitNames)
    .option("--json <json>", 'JSON input: {"set":["ext-a","ext-b"]}')
    .action(async (opts) => {
      const candidates = discoverExtensions();
      const candidatesByName = new Map(candidates.map((c) => [c.name, c]));

      const { value } = await resolveInput({
        flagsValue: opts.set,
        jsonFlag: opts.json,
        jsonSchema: ToggleJsonInputSchema,
        envVarName: "OHMYPI_TOGGLE_SET",
        interactive: () => interactiveToggle(candidates, candidatesByName),
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

      applySelection(candidates, paths);
    });
}

async function interactiveToggle(candidates, candidatesByName) {
  const settings = readSettings();
  const currentExtensions = Array.isArray(settings.extensions) ? settings.extensions : [];
  const candidatePaths = new Set(candidates.map((c) => c.path));
  let checkedByDefault = currentExtensions.filter((p) => candidatePaths.has(p));

  let selectedPaths;
  while (true) {
    const rawSelected = await checkbox({
      message: "Select extensions to always load globally (space to toggle, a to select all, i to invert, enter to confirm):",
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
