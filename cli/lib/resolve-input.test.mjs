import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { resolveInput } from "./resolve-input.mjs";

const schema = z.object({ set: z.array(z.string()) });

describe("resolveInput precedence", () => {
  it("explicit flags win over everything else", async () => {
    const result = await resolveInput({
      flagsValue: ["a"],
      jsonFlag: '{"set":["b"]}',
      jsonSchema: schema,
      envVarName: "TEST_ENV",
      interactive: vi.fn(),
      stdinIsTTY: true,
    });
    expect(result).toEqual({ source: "flags", value: ["a"] });
  });

  it("--json wins over stdin/env/interactive", async () => {
    const result = await resolveInput({
      flagsValue: undefined,
      jsonFlag: '{"set":["b"]}',
      jsonSchema: schema,
      envVarName: "TEST_ENV_UNSET_XYZ",
      interactive: vi.fn(),
      stdinIsTTY: true,
    });
    expect(result).toEqual({ source: "json-flag", value: { set: ["b"] } });
  });

  it("piped stdin wins over env/interactive when non-TTY", async () => {
    const result = await resolveInput({
      flagsValue: undefined,
      jsonFlag: undefined,
      jsonSchema: schema,
      envVarName: "TEST_ENV_UNSET_XYZ",
      interactive: vi.fn(),
      stdinIsTTY: false,
      stdinReader: async () => '{"set":["c"]}',
    });
    expect(result).toEqual({ source: "stdin-json", value: { set: ["c"] } });
  });

  it("env var wins over interactive when stdin has nothing piped", async () => {
    process.env.OHMYPI_TEST_VAR = '{"set":["d"]}';
    try {
      const result = await resolveInput({
        flagsValue: undefined,
        jsonFlag: undefined,
        jsonSchema: schema,
        envVarName: "OHMYPI_TEST_VAR",
        interactive: vi.fn(),
        stdinIsTTY: false,
        stdinReader: async () => "",
      });
      expect(result).toEqual({ source: "env", value: { set: ["d"] } });
    } finally {
      delete process.env.OHMYPI_TEST_VAR;
    }
  });

  it("falls back to interactive only when stdin is a TTY and nothing else is supplied", async () => {
    const interactive = vi.fn().mockResolvedValue({ set: ["e"] });
    const result = await resolveInput({
      flagsValue: undefined,
      jsonFlag: undefined,
      jsonSchema: schema,
      envVarName: "TEST_ENV_UNSET_XYZ",
      interactive,
      stdinIsTTY: true,
    });
    expect(interactive).toHaveBeenCalledOnce();
    expect(result).toEqual({ source: "interactive", value: { set: ["e"] } });
  });

  it("hard-fails when nothing is supplied and stdin is not a TTY", async () => {
    await expect(
      resolveInput({
        flagsValue: undefined,
        jsonFlag: undefined,
        jsonSchema: schema,
        envVarName: "TEST_ENV_UNSET_XYZ",
        interactive: vi.fn(),
        stdinIsTTY: false,
        stdinReader: async () => "",
      }),
    ).rejects.toThrow(/refusing to guess/);
  });
});
