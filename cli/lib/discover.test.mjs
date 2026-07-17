import { describe, expect, it } from "vitest";
import { discoverExtensions, discoverSkills, discoverThemes } from "./discover.mjs";

// Integration-style: exercises the real repo's extensions/themes/skills directories
// rather than fixtures, since this repo's own structure is the contract being tested.

describe("discoverExtensions", () => {
  it("finds both flat .ts and folder-style (index.ts) extensions, sorted by name", () => {
    const names = discoverExtensions().map((c) => c.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain("damage-control");
    expect(names).toContain("damage-control-continue");
    expect(names).toContain("plan-mode"); // folder-style
  });

  it("returns absolute paths", () => {
    const minimal = discoverExtensions().find((c) => c.name === "minimal");
    expect(minimal.path.startsWith("/")).toBe(true);
    expect(minimal.path.endsWith("minimal.ts")).toBe(true);
  });
});

describe("discoverThemes", () => {
  it("finds all flat .json theme files, sorted by name", () => {
    const names = discoverThemes().map((c) => c.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain("nord");
    expect(names).toContain("gruvbox");
    expect(names.length).toBeGreaterThanOrEqual(11);
  });
});

describe("discoverSkills", () => {
  it("finds <name>/SKILL.md directories", () => {
    const names = discoverSkills().map((c) => c.name);
    expect(names).toContain("using-ohmypi");
  });
});
