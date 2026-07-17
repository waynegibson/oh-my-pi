import chalk from "chalk";
import { discoverExtensions, discoverThemes } from "../lib/discover.mjs";
import { loadJobs } from "../lib/jobs.mjs";

export function registerList(program) {
  program
    .command("list")
    .description("List available jobs, extensions, and themes")
    .option("--json", "output as JSON")
    .action((opts) => {
      const jobs = Object.keys(loadJobs());
      const extensions = discoverExtensions().map((c) => c.name);
      const themes = discoverThemes().map((c) => c.name);

      if (opts.json) {
        console.log(JSON.stringify({ jobs, extensions, themes }));
        return;
      }

      console.log(chalk.bold("Jobs:"));
      for (const j of jobs) console.log(`  ${j}`);
      console.log(chalk.bold("Extensions:"));
      for (const e of extensions) console.log(`  ${e}`);
      console.log(chalk.bold("Themes:"));
      for (const t of themes) console.log(`  ${t}`);
    });
}
