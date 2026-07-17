import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  projectSettingsPath,
  readProjectSettings,
  upsertPackageEntry,
  writeProjectSettings,
} from "./project-settings.mjs";

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ohmypi-project-settings-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("projectSettingsPath", () => {
  it("points at <cwd>/.pi/settings.json", () => {
    expect(projectSettingsPath("/some/project")).toBe("/some/project/.pi/settings.json");
  });
});

describe("readProjectSettings / writeProjectSettings", () => {
  it("returns {} when the file doesn't exist yet", () => {
    expect(readProjectSettings(dir)).toEqual({});
  });

  it("creates .pi/ and writes settings, round-trips", () => {
    writeProjectSettings(dir, { packages: [{ source: "git:x@v1" }] });
    expect(readProjectSettings(dir)).toEqual({ packages: [{ source: "git:x@v1" }] });
  });
});

describe("upsertPackageEntry", () => {
  it("appends a new entry when no matching source exists", () => {
    const result = upsertPackageEntry({}, { source: "git:host/repo@v1", extensions: ["a"] });
    expect(result.packages).toEqual([{ source: "git:host/repo@v1", extensions: ["a"] }]);
  });

  it("replaces an existing entry with the same source identity (ignoring @ref)", () => {
    const before = { packages: [{ source: "git:host/repo@v1", extensions: ["a"] }] };
    const result = upsertPackageEntry(before, { source: "git:host/repo@v2", extensions: ["b"] });
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]).toEqual({ source: "git:host/repo@v2", extensions: ["b"] });
  });

  it("does not touch unrelated package entries", () => {
    const before = { packages: [{ source: "git:other/repo@v1", extensions: ["x"] }] };
    const result = upsertPackageEntry(before, { source: "git:host/repo@v1", extensions: ["a"] });
    expect(result.packages).toHaveLength(2);
  });

  it("does not mutate the input settings object", () => {
    const before = { packages: [{ source: "git:host/repo@v1", extensions: ["a"] }] };
    upsertPackageEntry(before, { source: "git:host/repo@v2", extensions: ["b"] });
    expect(before.packages[0].extensions).toEqual(["a"]);
  });
});
