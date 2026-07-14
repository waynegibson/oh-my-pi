#!/usr/bin/env node
/**
 * Interactively choose which extensions/ are always loaded (globally, no -e flag needed).
 *
 * Writes absolute paths into base/agent/settings.json's "extensions" array — the
 * documented "Additional paths via settings.json" mechanism (docs/extensions.md). The
 * doc's own example shows absolute paths here specifically (its "packages" array example
 * only ever shows npm:/git: sources, never a local path) — an earlier attempt to write
 * relative local paths into "packages" instead was reverted after it was verified, via a
 * real interactive pi session capture (not just source-reading), to not actually load:
 * the startup banner showed no [Extensions] section and minimal.ts's custom footer never
 * applied. "extensions" with absolute paths is the version confirmed to work end-to-end.
 *
 * This also does NOT symlink into base/agent/extensions/ — an earlier attempt at that was
 * reverted because jiti (Pi's .ts loader) resolves relative imports via Node's classic CJS
 * algorithm, which does not resolve a symlinked directory's realpath first, and every
 * extension here imports "./theme-map.ts" or "../theme-map.ts".
 *
 * Trade-off: absolute paths are machine-specific, so base/agent/settings.json's
 * "extensions" array isn't portable if this repo is cloned to a different path. Re-run
 * this script once after cloning elsewhere to regenerate correct paths for that machine.
 *
 * Usage: node scripts/toggle-extensions.mjs
 * Ctrl+C at any prompt cancels cleanly with no changes written.
 */

import { checkbox, select } from "@inquirer/prompts";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_DIR = join(REPO_ROOT, "extensions");
const SETTINGS_PATH = join(REPO_ROOT, "base", "agent", "settings.json");

// Groups of extension names that must never be simultaneously active (e.g. they hook the
// same events and would double-fire). At most one per group may be selected — resolved
// interactively before anything is written, not just warned about after the fact. Add new
// groups here as more conflicting extensions are introduced; no other code changes needed.
const MUTUALLY_EXCLUSIVE_GROUPS = [["damage-control", "damage-control-continue"]];

const BACK_TO_SELECTION = Symbol("back-to-selection");
const NEITHER = Symbol("neither");

function discoverCandidates() {
  const entries = readdirSync(EXT_DIR, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      const name = entry.name.slice(0, -3);
      candidates.push({ name, path: join(EXT_DIR, entry.name) });
    } else if (entry.isDirectory()) {
      const indexPath = join(EXT_DIR, entry.name, "index.ts");
      if (statSyncSafe(indexPath)) {
        candidates.push({ name: entry.name, path: join(EXT_DIR, entry.name) });
      }
    }
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

function statSyncSafe(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

function readSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read ${SETTINGS_PATH}: ${err.message}`);
  }
}

function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
}

/**
 * Resolve any mutually-exclusive-group violations. Returns the resolved selection array,
 * or BACK_TO_SELECTION if the user asked to redo the checkbox instead of resolving inline.
 */
async function resolveConflicts(selected, candidatesByName) {
  let resolved = selected;
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

async function main() {
  const candidates = discoverCandidates();
  if (candidates.length === 0) {
    console.log(`No extensions found in ${EXT_DIR}`);
    return;
  }
  const candidatesByName = new Map(candidates.map((c) => [c.name, c]));

  const settings = readSettings();
  const currentExtensions = Array.isArray(settings.extensions) ? settings.extensions : [];
  const candidatePaths = new Set(candidates.map((c) => c.path));

  // Preserve any existing extensions entries that aren't one of our known candidates (an
  // unrelated local extension added by hand) — only manage entries we own.
  const untouchedExtensions = currentExtensions.filter((p) => !candidatePaths.has(p));

  // Starts pre-checked from whatever's already configured; if a conflict resolution sends us
  // back here, checkedByDefault carries over the attempted selection instead of resetting.
  let checkedByDefault = currentExtensions;

  let selected;
  while (true) {
    const rawSelected = await checkbox({
      message: "Select extensions to always load globally (space to toggle, a to select all, i to invert, enter to confirm):",
      choices: candidates.map((c) => ({
        name: c.name,
        value: c.path,
        checked: checkedByDefault.includes(c.path),
      })),
    });

    const resolution = await resolveConflicts(rawSelected, candidatesByName);
    if (resolution === BACK_TO_SELECTION) {
      checkedByDefault = rawSelected;
      continue;
    }
    selected = resolution;
    break;
  }

  settings.extensions = [...untouchedExtensions, ...selected];
  writeSettings(settings);

  const selectedSet = new Set(selected);
  const added = candidates.filter((c) => selectedSet.has(c.path) && !currentExtensions.includes(c.path));
  const removed = candidates.filter((c) => !selectedSet.has(c.path) && currentExtensions.includes(c.path));

  if (added.length > 0) {
    console.log(`Added to global extensions: ${added.map((c) => c.name).join(", ")}`);
  }
  if (removed.length > 0) {
    console.log(`Removed from global extensions: ${removed.map((c) => c.name).join(", ")}`);
  }
  if (added.length === 0 && removed.length === 0) {
    console.log("No changes.");
  }
}

try {
  await main();
} catch (err) {
  if (err instanceof Error && err.name === "ExitPromptError") {
    console.log("\nCancelled — no changes made.");
    process.exit(0);
  }
  throw err;
}
