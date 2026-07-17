import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProjectPackageEntry,
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

describe("buildProjectPackageEntry", () => {
  const toRepoRelative = (p) => p.replace("/repo/", "");
  const skillCandidates = [{ name: "using-ohmypi", path: "/repo/skills/using-ohmypi" }];
  const themeCandidates = [
    { name: "nord", path: "/repo/themes/nord.json" },
    { name: "dracula", path: "/repo/themes/dracula.json" },
  ];

  it("emits explicit [] for skills/themes when nothing was selected", () => {
    const entry = buildProjectPackageEntry("git:x@v1", ["extensions/a.ts"], {}, {}, skillCandidates, themeCandidates, toRepoRelative);
    expect(entry).toEqual({ source: "git:x@v1", extensions: ["extensions/a.ts"], skills: [], themes: [] });
  });

  it("uses the job's own skills/theme as the base", () => {
    const jobDef = { skills: ["using-ohmypi"], theme: "nord" };
    const entry = buildProjectPackageEntry("git:x@v1", [], jobDef, {}, skillCandidates, themeCandidates, toRepoRelative);
    expect(entry.skills).toEqual(["skills/using-ohmypi"]);
    expect(entry.themes).toEqual(["themes/nord.json"]);
  });

  it("layers ad hoc skills on top of the job's skills, deduped", () => {
    const jobDef = { skills: ["using-ohmypi"] };
    const entry = buildProjectPackageEntry(
      "git:x@v1",
      [],
      jobDef,
      { adHocSkills: ["using-ohmypi"] },
      skillCandidates,
      themeCandidates,
      toRepoRelative,
    );
    expect(entry.skills).toEqual(["skills/using-ohmypi"]);
  });

  it("an ad hoc theme overrides the job's own theme", () => {
    const jobDef = { theme: "nord" };
    const entry = buildProjectPackageEntry(
      "git:x@v1",
      [],
      jobDef,
      { adHocTheme: "dracula" },
      skillCandidates,
      themeCandidates,
      toRepoRelative,
    );
    expect(entry.themes).toEqual(["themes/dracula.json"]);
  });

  it("throws on an unknown ad hoc skill name", () => {
    expect(() =>
      buildProjectPackageEntry("git:x@v1", [], {}, { adHocSkills: ["nope"] }, skillCandidates, themeCandidates, toRepoRelative),
    ).toThrow(/unknown skill "nope"/);
  });

  it("throws on an unknown ad hoc theme name", () => {
    expect(() =>
      buildProjectPackageEntry("git:x@v1", [], {}, { adHocTheme: "nope" }, skillCandidates, themeCandidates, toRepoRelative),
    ).toThrow(/unknown theme "nope"/);
  });
});
