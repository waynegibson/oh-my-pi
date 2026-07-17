import { spawn } from "node:child_process";
import { select } from "@inquirer/prompts";
import { discoverExtensions, discoverThemes } from "../lib/discover.mjs";
import { loadJobs } from "../lib/jobs.mjs";
import { findConflict } from "../lib/conflicts.mjs";
import { resolveInput } from "../lib/resolve-input.mjs";
import { RunJsonInputSchema } from "../lib/schemas.mjs";

function collect(value, previous) {
  return previous.concat([value]);
}

export function registerRun(program, { piArgs }) {
  program
    .command("run")
    .description("Resolve a job (or ad hoc flags) to Pi extensions/theme and launch pi")
    .argument("[job]", "job name from jobs.json")
    .option("-e, --extension <name>", "extension name to add (repeatable, additive to a job)", collect, [])
    .option("-t, --theme <name>", "theme name (overrides the job's theme)")
    .option("--json <json>", 'JSON input: {"job":"...", "extensions":[...], "theme":"..."}')
    .option("--dry-run", "print the resolved plan as JSON and exit without launching pi")
    .action(async (job, opts) => {
      const flagsValue =
        job !== undefined || opts.extension.length > 0 || opts.theme !== undefined
          ? { job, extensions: opts.extension, theme: opts.theme }
          : undefined;

      const { value } = await resolveInput({
        flagsValue,
        jsonFlag: opts.json,
        jsonSchema: RunJsonInputSchema,
        envVarName: "OHMYPI_RUN",
        interactive: interactiveJobPicker,
      });

      const plan = buildPlan(value);

      if (opts.dryRun) {
        console.log(JSON.stringify(plan));
        return;
      }

      await launchPi(plan, piArgs);
    });
}

async function interactiveJobPicker() {
  const jobs = loadJobs();
  const names = Object.keys(jobs);
  if (names.length === 0) {
    throw new Error("no jobs defined in jobs.json");
  }
  const job = await select({
    message: "Select a job to run:",
    choices: names.map((name) => ({ name, value: name })),
  });
  return { job };
}

function buildPlan(value) {
  let jobDef;
  if (value.job !== undefined) {
    const jobs = loadJobs();
    jobDef = jobs[value.job];
    if (!jobDef) {
      throw new Error(`unknown job "${value.job}" — run \`ohmypi list\` to see available jobs`);
    }
  }

  const extNames = [...new Set([...(jobDef?.extensions ?? []), ...(value.extensions ?? [])])];
  const themeName = value.theme ?? jobDef?.theme;

  const conflict = findConflict(extNames);
  if (conflict) {
    throw new Error(
      `mutually-exclusive extensions selected: ${conflict.conflicting.join(", ")} (group: ${conflict.group.join("/")})`,
    );
  }

  const extCandidates = discoverExtensions();
  const extByName = new Map(extCandidates.map((c) => [c.name, c.path]));
  const extensions = extNames.map((name) => {
    const path = extByName.get(name);
    if (!path) {
      throw new Error(`unknown extension "${name}" — valid: ${extCandidates.map((c) => c.name).join(", ")}`);
    }
    return path;
  });

  let theme = null;
  if (themeName) {
    const themeCandidates = discoverThemes();
    const match = themeCandidates.find((c) => c.name === themeName);
    if (!match) {
      throw new Error(`unknown theme "${themeName}" — valid: ${themeCandidates.map((c) => c.name).join(", ")}`);
    }
    theme = match.path;
  }

  return { extensions, theme };
}

async function launchPi(plan, piArgs) {
  const args = [];
  for (const p of plan.extensions) args.push("-e", p);
  if (plan.theme) args.push("--theme", plan.theme);
  args.push(...piArgs);

  console.error(`→ pi ${args.join(" ")}`);

  const code = await new Promise((resolve) => {
    const child = spawn("pi", args, { stdio: "inherit" });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.on("error", (err) => {
      console.error(`ohmypi: failed to launch pi: ${err.message}`);
      resolve(1);
    });
  });

  process.exitCode = code;
}
