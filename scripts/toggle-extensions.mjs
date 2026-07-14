#!/usr/bin/env node
/**
 * Interactively choose which extensions/ are always loaded (globally, no -e flag needed).
 *
 * Writes relative paths into base/agent/settings.json's "packages" array (as local package
 * sources) — confirmed by reading the installed package's own source
 * (dist/core/package-manager.js: getBaseDirForScope, resolveLocalExtensionSource) rather
 * than assumed from docs. For "user"/global scope, local package paths in "packages"
 * resolve relative to agentDir (base/agent/ here), so a relative path like
 * "../../extensions/foo.ts" is portable across machines and doesn't leak an absolute,
 * machine-specific path into a version-controlled file.
 *
 * This intentionally does NOT use the plain "extensions" array (docs/extensions.md's
 * "Additional paths via settings.json") — that one resolves relative paths against cwd
 * (dist/core/resource-loader.js: resolveResourcePath), which would break depending on
 * where `pi` happens to be launched from. It also does NOT symlink into
 * base/agent/extensions/ — an earlier attempt at that was reverted because jiti (Pi's .ts
 * loader) resolves relative imports via Node's classic CJS algorithm, which does not
 * resolve a symlinked directory's realpath first, and every extension here imports
 * "./theme-map.ts" or "../theme-map.ts".
 *
 * A bare directory with no package.json (like plan-mode/) is handled correctly: package-
 * manager.js's resolveLocalExtensionSource falls back to treating the whole directory as
 * a single extension (looking for index.ts) when it finds no package manifest or
 * conventional resource subdirectories inside it.
 *
 * Usage: node scripts/toggle-extensions.mjs
 * Ctrl+C at any prompt cancels cleanly with no changes written.
 */

import { checkbox, select } from "@inquirer/prompts";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_DIR = join(REPO_ROOT, "extensions");
const SETTINGS_PATH = join(REPO_ROOT, "base", "agent", "settings.json");
const SETTINGS_DIR = dirname(SETTINGS_PATH);

// Shared helper modules with no default export — not loadable as extensions themselves.
const EXCLUDE = new Set(["theme-map"]);

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
      if (!EXCLUDE.has(name)) {
        candidates.push(makeCandidate(name, join(EXT_DIR, entry.name)));
      }
    } else if (entry.isDirectory()) {
      const indexPath = join(EXT_DIR, entry.name, "index.ts");
      if (statSyncSafe(indexPath)) {
        candidates.push(makeCandidate(entry.name, join(EXT_DIR, entry.name)));
      }
    }
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}

function makeCandidate(name, absPath) {
  return { name, absPath, relPath: relative(SETTINGS_DIR, absPath) };
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
    const groupRelPaths = group.map((name) => candidatesByName.get(name)?.relPath).filter(Boolean);
    const selectedInGroup = groupRelPaths.filter((p) => resolved.includes(p));
    if (selectedInGroup.length <= 1) continue;

    const selectedNames = group.filter((name) => selectedInGroup.includes(candidatesByName.get(name)?.relPath));
    const keep = await select({
      message: `${selectedNames.join(" and ")} conflict (same events, would double-fire) — pick one to keep:`,
      choices: [
        ...selectedNames.map((name) => ({ name: `Keep ${name}`, value: candidatesByName.get(name).relPath })),
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
  const currentPackages = Array.isArray(settings.packages) ? settings.packages : [];
  const candidateRelPaths = new Set(candidates.map((c) => c.relPath));

  // Preserve any existing packages entries that aren't one of our known candidates (npm:/git:
  // sources, or an unrelated local extension added by hand) — only manage entries we own.
  const untouchedPackages = currentPackages.filter((p) => !candidateRelPaths.has(p));

  // Starts pre-checked from whatever's already configured; if a conflict resolution sends us
  // back here, checkedByDefault carries over the attempted selection instead of resetting.
  let checkedByDefault = currentPackages;

  let selected;
  while (true) {
    const rawSelected = await checkbox({
      message: "Select extensions to always load globally (space to toggle, a to select all, i to invert, enter to confirm):",
      choices: candidates.map((c) => ({
        name: c.name,
        value: c.relPath,
        checked: checkedByDefault.includes(c.relPath),
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

  settings.packages = [...untouchedPackages, ...selected];
  writeSettings(settings);

  const selectedSet = new Set(selected);
  const added = candidates.filter((c) => selectedSet.has(c.relPath) && !currentPackages.includes(c.relPath));
  const removed = candidates.filter((c) => !selectedSet.has(c.relPath) && currentPackages.includes(c.relPath));

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
