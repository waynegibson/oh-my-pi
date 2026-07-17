import { z } from "zod";

export const JobDefSchema = z.object({
  extensions: z.array(z.string().min(1)).default([]),
  theme: z.string().min(1).optional(),
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
