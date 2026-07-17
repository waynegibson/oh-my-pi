import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadJobs } from "./jobs.mjs";

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ohmypi-jobs-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeJobs(obj) {
  const p = join(dir, "jobs.json");
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe("loadJobs", () => {
  it("loads the repo's real jobs.json without error", () => {
    const jobs = loadJobs();
    expect(Object.keys(jobs).length).toBeGreaterThan(0);
  });

  it("accepts a valid job with all fields", () => {
    const p = writeJobs({
      "a-job": {
        extensions: ["minimal"],
        theme: "nord",
        mode: "interactive",
        skills: ["using-ohmypi"],
        contextFile: "context/backend-fix.md",
      },
    });
    expect(() => loadJobs(p)).not.toThrow();
  });

  it("rejects an unknown extension name", () => {
    const p = writeJobs({ "bad-job": { extensions: ["does-not-exist"] } });
    expect(() => loadJobs(p)).toThrow(/unknown extension "does-not-exist"/);
  });

  it("rejects an unknown theme name", () => {
    const p = writeJobs({ "bad-job": { theme: "does-not-exist" } });
    expect(() => loadJobs(p)).toThrow(/unknown theme "does-not-exist"/);
  });

  it("rejects an unknown skill name", () => {
    const p = writeJobs({ "bad-job": { skills: ["does-not-exist"] } });
    expect(() => loadJobs(p)).toThrow(/unknown skill "does-not-exist"/);
  });

  it("rejects a missing contextFile", () => {
    const p = writeJobs({ "bad-job": { contextFile: "context/does-not-exist.md" } });
    expect(() => loadJobs(p)).toThrow(/missing contextFile/);
  });

  it("rejects mutually-exclusive extensions in one job", () => {
    const p = writeJobs({ "bad-job": { extensions: ["damage-control", "damage-control-continue"] } });
    expect(() => loadJobs(p)).toThrow(/mutually-exclusive/);
  });

  it("rejects an autonomous job selecting the hard-block damage-control variant", () => {
    const p = writeJobs({ "bad-job": { mode: "autonomous", extensions: ["damage-control"] } });
    expect(() => loadJobs(p)).toThrow(/is mode "autonomous" but selects "damage-control"/);
  });

  it("allows an autonomous job selecting damage-control-continue", () => {
    const p = writeJobs({ "ok-job": { mode: "autonomous", extensions: ["damage-control-continue"] } });
    expect(() => loadJobs(p)).not.toThrow();
  });
});
