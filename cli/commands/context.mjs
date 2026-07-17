import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import { loadJobs } from "../lib/jobs.mjs";
import { GLOBAL_AGENTS_MD_PATH, REPO_ROOT } from "../lib/paths.mjs";

export function registerContext(program) {
  program
    .command("context")
    .description("Print a job's contextFile, or (--global) apply it to ~/.pi/agent/AGENTS.md")
    .argument("<job>", "job name from jobs.json")
    .option("--global", "idempotently write into ~/.pi/agent/AGENTS.md instead of printing to stdout")
    .option("--remove", "remove this job's block from ~/.pi/agent/AGENTS.md instead of writing it")
    .action((job, opts) => {
      const jobs = loadJobs();
      const jobDef = jobs[job];
      if (!jobDef) {
        throw new Error(`unknown job "${job}" — run \`ohmypi list\` to see available jobs`);
      }

      if (opts.remove) {
        removeGlobal(job);
        return;
      }

      if (!jobDef.contextFile) {
        throw new Error(`job "${job}" has no contextFile`);
      }

      const content = readFileSync(join(REPO_ROOT, jobDef.contextFile), "utf8").trimEnd();

      if (opts.global) {
        applyGlobal(job, content);
        return;
      }

      console.log(content);
    });
}

function removeGlobal(job) {
  const startMarker = `<!-- ohmypi:${job}:start -->`;
  const endMarker = `<!-- ohmypi:${job}:end -->`;

  if (!existsSync(GLOBAL_AGENTS_MD_PATH)) {
    console.log(chalk.yellow(`${GLOBAL_AGENTS_MD_PATH} doesn't exist — nothing to remove.`));
    return;
  }

  const existing = readFileSync(GLOBAL_AGENTS_MD_PATH, "utf8");
  const blockRegex = new RegExp(`\\n*${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n*`);

  if (!blockRegex.test(existing)) {
    console.log(chalk.yellow(`No "${job}" block found in ${GLOBAL_AGENTS_MD_PATH} — nothing to remove.`));
    return;
  }

  const updated = existing.replace(blockRegex, "\n");
  writeFileSync(GLOBAL_AGENTS_MD_PATH, updated.trimStart());
  console.log(chalk.green(`Removed ${job}'s context block from ${GLOBAL_AGENTS_MD_PATH}`));
}

function applyGlobal(job, content) {
  const startMarker = `<!-- ohmypi:${job}:start -->`;
  const endMarker = `<!-- ohmypi:${job}:end -->`;
  const block = `${startMarker}\n${content}\n${endMarker}`;

  mkdirSync(dirname(GLOBAL_AGENTS_MD_PATH), { recursive: true });
  const existing = existsSync(GLOBAL_AGENTS_MD_PATH) ? readFileSync(GLOBAL_AGENTS_MD_PATH, "utf8") : "";

  const blockRegex = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
  );

  let updated;
  if (blockRegex.test(existing)) {
    updated = existing.replace(blockRegex, block);
  } else if (existing.trim().length > 0) {
    updated = `${existing.trimEnd()}\n\n${block}\n`;
  } else {
    updated = `${block}\n`;
  }

  writeFileSync(GLOBAL_AGENTS_MD_PATH, updated);
  console.log(chalk.green(`Wrote ${job}'s context block to ${GLOBAL_AGENTS_MD_PATH}`));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
