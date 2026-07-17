#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { registerRun } from "./commands/run.mjs";
import { registerToggle } from "./commands/toggle.mjs";
import { registerList } from "./commands/list.mjs";
import { registerContext } from "./commands/context.mjs";

// Pass-through args after a literal `--` go straight to `pi` (run command), not to
// commander's own option parser — split them off before commander ever sees them.
const dashIndex = process.argv.indexOf("--");
let piArgs = [];
let argv = process.argv;
if (dashIndex !== -1) {
  piArgs = process.argv.slice(dashIndex + 1);
  argv = process.argv.slice(0, dashIndex);
}

const program = new Command("ohmypi").description("Job-scoped Pi extension/theme launcher");
registerRun(program, { piArgs });
registerToggle(program);
registerList(program);
registerContext(program);

try {
  await program.parseAsync(argv);
} catch (err) {
  console.error(chalk.red(`ohmypi: ${err.message}`));
  process.exit(1);
}
