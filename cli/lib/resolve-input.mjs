function readStdinIfPiped() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

/**
 * Shared precedence resolver used by both `run` and `toggle`:
 *   explicit flags > --json / piped stdin > env var > interactive (TTY only)
 * Nothing supplied and stdin is not a TTY -> hard error, never guess.
 *
 * @param {object} opts
 * @param {*} opts.flagsValue - already-extracted value from commander flags, or undefined
 * @param {string|undefined} opts.jsonFlag - raw --json string, if passed
 * @param {import('zod').ZodType} opts.jsonSchema
 * @param {string} opts.envVarName
 * @param {() => Promise<*>} opts.interactive
 * @param {boolean} [opts.stdinIsTTY]
 * @param {() => Promise<string>} [opts.stdinReader] - overridable for tests, avoids touching real stdin
 */
export async function resolveInput(opts) {
  const stdinIsTTY = opts.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdinReader = opts.stdinReader ?? readStdinIfPiped;

  if (opts.flagsValue !== undefined) {
    return { source: "flags", value: opts.flagsValue };
  }

  if (opts.jsonFlag !== undefined) {
    const parsed = JSON.parse(opts.jsonFlag);
    return { source: "json-flag", value: opts.jsonSchema.parse(parsed) };
  }

  if (!stdinIsTTY) {
    const text = await stdinReader();
    if (text.trim()) {
      return { source: "stdin-json", value: opts.jsonSchema.parse(JSON.parse(text)) };
    }
  }

  const envVal = process.env[opts.envVarName];
  if (envVal !== undefined) {
    return { source: "env", value: opts.jsonSchema.parse(JSON.parse(envVal)) };
  }

  if (stdinIsTTY) {
    return { source: "interactive", value: await opts.interactive() };
  }

  throw new Error(
    `no input supplied (no flags, --json, stdin, or ${opts.envVarName}) and stdin is not a TTY — refusing to guess`,
  );
}
