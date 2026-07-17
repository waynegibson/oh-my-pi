import { describe, expect, it } from "vitest";
import { findConflict, MUTUALLY_EXCLUSIVE_GROUPS } from "./conflicts.mjs";

describe("findConflict", () => {
  it("returns null when no group has more than one member selected", () => {
    expect(findConflict(["minimal", "theme-cycler"])).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(findConflict([])).toBeNull();
  });

  it("detects the damage-control pair", () => {
    const conflict = findConflict(["damage-control", "damage-control-continue", "minimal"]);
    expect(conflict).not.toBeNull();
    expect(conflict.group).toEqual(["damage-control", "damage-control-continue"]);
    expect(conflict.conflicting.sort()).toEqual(["damage-control", "damage-control-continue"]);
  });

  it("does not flag a single member of a conflicting group", () => {
    expect(findConflict(["damage-control", "minimal"])).toBeNull();
  });

  it("MUTUALLY_EXCLUSIVE_GROUPS is a non-empty array of pairs+ groups", () => {
    expect(MUTUALLY_EXCLUSIVE_GROUPS.length).toBeGreaterThan(0);
    for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
      expect(group.length).toBeGreaterThanOrEqual(2);
    }
  });
});
