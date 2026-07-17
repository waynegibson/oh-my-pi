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
  const skillCandidates = [
    { name: "using-ohmypi", path: "/repo/skills/productivity/using-ohmypi" },
    { name: "other-skill", path: "/repo/skills/productivity/other-skill" },
  ];
  const themeCandidates = [
    { name: "nord", path: "/repo/themes/nord.json" },
    { name: "dracula", path: "/repo/themes/dracula.json" },
  ];

  it("emits explicit [] for themes but omits skills entirely when nothing was selected — skills default to all", () => {
    const entry = buildProjectPackageEntry("git:x@v1", ["extensions/a.ts"], {}, {}, skillCandidates, themeCandidates, toRepoRelative);
    expect(entry).toEqual({ source: "git:x@v1", extensions: ["extensions/a.ts"], themes: [] });
    expect(entry.skills).toBeUndefined();
  });

  it("uses the job's own skills/theme as the base", () => {
    const jobDef = { skills: ["using-ohmypi"], theme: "nord" };
    const entry = buildProjectPackageEntry("git:x@v1", [], jobDef, {}, skillCandidates, themeCandidates, toRepoRelative);
    expect(entry.skills).toEqual(["skills/productivity/using-ohmypi"]);
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
    expect(entry.skills).toEqual(["skills/productivity/using-ohmypi"]);
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

  it("writes a wildcard-plus-exclusions pattern for the job's own excludeSkills", () => {
    const jobDef = { excludeSkills: ["other-skill"] };
    const entry = buildProjectPackageEntry("git:x@v1", [], jobDef, {}, skillCandidates, themeCandidates, toRepoRelative);
    expect(entry.skills).toEqual(["skills/**", "!skills/productivity/other-skill"]);
  });

  it("layers an ad hoc exclusion on top of the job's excludeSkills, deduped", () => {
    const jobDef = { excludeSkills: ["other-skill"] };
    const entry = buildProjectPackageEntry(
      "git:x@v1",
      [],
      jobDef,
      { adHocExcludeSkills: ["other-skill"] },
      skillCandidates,
      themeCandidates,
      toRepoRelative,
    );
    expect(entry.skills).toEqual(["skills/**", "!skills/productivity/other-skill"]);
  });

  it("an explicit include list wins over excludeSkills if somehow both are non-empty", () => {
    const entry = buildProjectPackageEntry(
      "git:x@v1",
      [],
      {},
      { adHocSkills: ["using-ohmypi"] },
      skillCandidates,
      themeCandidates,
      toRepoRelative,
    );
    expect(entry.skills).toEqual(["skills/productivity/using-ohmypi"]);
  });

  it("throws when a job's skills and excludeSkills are both non-empty", () => {
    const jobDef = { skills: ["using-ohmypi"], excludeSkills: ["other-skill"] };
    expect(() => buildProjectPackageEntry("git:x@v1", [], jobDef, {}, skillCandidates, themeCandidates, toRepoRelative)).toThrow(
      /contradictory/,
    );
  });

  it("throws when ad hoc -s and -x are both given", () => {
    expect(() =>
      buildProjectPackageEntry(
        "git:x@v1",
        [],
        {},
        { adHocSkills: ["using-ohmypi"], adHocExcludeSkills: ["other-skill"] },
        skillCandidates,
        themeCandidates,
        toRepoRelative,
      ),
    ).toThrow(/contradictory/);
  });

  it("throws on an unknown excludeSkills name", () => {
    const jobDef = { excludeSkills: ["nope"] };
    expect(() => buildProjectPackageEntry("git:x@v1", [], jobDef, {}, skillCandidates, themeCandidates, toRepoRelative)).toThrow(
      /unknown skill "nope"/,
    );
  });
});
