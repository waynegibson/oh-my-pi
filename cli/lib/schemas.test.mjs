import { describe, expect, it } from "vitest";
import { JobDefSchema, JobsFileSchema, RunJsonInputSchema, ToggleJsonInputSchema } from "./schemas.mjs";

describe("JobDefSchema", () => {
  it("applies defaults for a minimal job", () => {
    const parsed = JobDefSchema.parse({});
    expect(parsed).toEqual({ extensions: [], mode: "interactive", skills: [], excludeSkills: [] });
  });

  it("accepts a fully-specified job", () => {
    const parsed = JobDefSchema.parse({
      extensions: ["minimal"],
      theme: "nord",
      mode: "autonomous",
      skills: ["using-ohmypi"],
      contextFile: "context/x.md",
    });
    expect(parsed.mode).toBe("autonomous");
    expect(parsed.theme).toBe("nord");
  });

  it("rejects an invalid mode value", () => {
    expect(() => JobDefSchema.parse({ mode: "yolo" })).toThrow();
  });
});

describe("JobsFileSchema", () => {
  it("parses a map of job names to job defs", () => {
    const parsed = JobsFileSchema.parse({ "a-job": { extensions: ["minimal"] } });
    expect(Object.keys(parsed)).toEqual(["a-job"]);
  });
});

describe("RunJsonInputSchema", () => {
  it("accepts input with just a job", () => {
    expect(() => RunJsonInputSchema.parse({ job: "backend-fix" })).not.toThrow();
  });

  it("accepts input with just extensions", () => {
    expect(() => RunJsonInputSchema.parse({ extensions: ["minimal"] })).not.toThrow();
  });

  it("rejects input with neither job nor extensions", () => {
    expect(() => RunJsonInputSchema.parse({ theme: "nord" })).toThrow();
  });
});

describe("ToggleJsonInputSchema", () => {
  it("requires a set array", () => {
    expect(() => ToggleJsonInputSchema.parse({ set: ["minimal"] })).not.toThrow();
    expect(() => ToggleJsonInputSchema.parse({})).toThrow();
  });
});
