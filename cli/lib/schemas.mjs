import { z } from "zod";

export const JobDefSchema = z.object({
  extensions: z.array(z.string().min(1)).default([]),
  theme: z.string().min(1).optional(),
  mode: z.enum(["interactive", "autonomous"]).default("interactive"),
  // `skills` is an allow-list (only these load). `excludeSkills` is a deny-list against an
  // otherwise-load-all default (everything except these). Setting both is contradictory —
  // rejected in jobs.mjs's semantic validation pass, not here (needs the skill catalog).
  skills: z.array(z.string().min(1)).default([]),
  excludeSkills: z.array(z.string().min(1)).default([]),
  contextFile: z.string().min(1).optional(),
});

export const JobsFileSchema = z.record(z.string().min(1), JobDefSchema);

// `ohmypi run --json '...'` / piped stdin / env var input
export const RunJsonInputSchema = z
  .object({
    job: z.string().min(1).optional(),
    extensions: z.array(z.string().min(1)).optional(),
    theme: z.string().min(1).optional(),
  })
  .refine((v) => v.job !== undefined || v.extensions !== undefined, {
    message: "must specify either 'job' or 'extensions'",
  });

// `ohmypi toggle --json '...'` / piped stdin / env var input
export const ToggleJsonInputSchema = z.object({
  set: z.array(z.string().min(1)),
});
