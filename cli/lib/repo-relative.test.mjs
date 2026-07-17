import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./paths.mjs";
import { toRepoRelative } from "./repo-relative.mjs";

describe("toRepoRelative", () => {
  it("converts an absolute path under REPO_ROOT to a forward-slash relative path", () => {
    const abs = join(REPO_ROOT, "extensions", "minimal.ts");
    expect(toRepoRelative(abs)).toBe("extensions/minimal.ts");
  });

  it("handles a folder-style extension path", () => {
    const abs = join(REPO_ROOT, "extensions", "plan-mode");
    expect(toRepoRelative(abs)).toBe("extensions/plan-mode");
  });

  it("handles a nested skill path", () => {
    const abs = join(REPO_ROOT, "skills", "using-ohmypi");
    expect(toRepoRelative(abs)).toBe("skills/using-ohmypi");
  });
});
