import { readFileSync, writeFileSync } from "node:fs";
import { SETTINGS_PATH } from "./paths.mjs";

export function readSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read ${SETTINGS_PATH}: ${err.message}`);
  }
}

export function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
}
