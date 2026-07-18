/**
 * theme-map.ts — Per-extension default theme assignments
 *
 * Not an extension itself — a shared helper imported by extensions/*, which is why it
 * lives in lib/ instead of extensions/ (Pi's extension auto-discovery, and our own
 * scripts/toggle-extensions.mjs, only look inside extensions/).
 *
 * Themes live in the repo-root themes/ directory (sibling of extensions/ and lib/).
 * There is deliberately no base/agent/themes symlink anymore: Pi always scans
 * ~/.pi/agent/themes/ as a default directory regardless of what's explicitly
 * registered, so a blanket symlink there means every custom theme is discovered on
 * every launch, cluttering the startup [Themes] banner even when only one extension
 * (with one assigned theme) is active. Instead, registerThemeDiscovery() registers only
 * what's actually needed for the calling extension:
 *
 *   - theme-cycler is active  -> register the whole themes/ directory (cycling/picking
 *     needs the full set to mean anything)
 *   - any other extension     -> register only its own THEME_MAP-assigned theme file
 *
 * Call registerThemeDiscovery(pi, import.meta.url) once in each extension's factory body
 * (not inside session_start — resources_discover must be registered before it fires on
 * startup). Extensions deliberately do NOT auto-apply their mapped theme on session_start
 * — only registerThemeDiscovery, which makes it *available* to pick (via /theme, -t, or
 * ohmypi toggle's theme filter), not *active*. Multiple extensions stacked together (the
 * common case via ohmypi toggle, which loads via settings.json/packages rather than -e
 * flags) had no reliable way to agree on a single "primary" one, so each would race to
 * call ctx.ui.setTheme() on its own 150ms timer — whichever fired last won, and Pi logged
 * a registration collision for every theme along the way. Theme selection is one
 * deliberate choice now: a job's own `theme` field (jobs.json), theme-cycler's manual
 * /theme picker, or Pi's own settings — never an extension's side effect.
 *
 * Available themes (themes/):
 *   catppuccin-mocha · cyberpunk · dracula · everforest · gruvbox
 *   midnight-ocean   · nord      · ocean-breeze · rose-pine
 *   synthwave        · tokyo-night
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Absolute path to the repo-root themes/ directory, resolved relative to this file
// (not ctx.cwd), so it works regardless of where pi is launched from.
const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "themes");

// Real path of THEMES_DIR, resolved once at load time. Used to tell "our" themes apart
// from Pi's own bundled dark/light in the /theme picker.
const CUSTOM_THEMES_DIR = (() => {
  try {
    return realpathSync(THEMES_DIR);
  } catch {
    return null;
  }
})();

/** Tag a theme's file path as "[custom]" (repo-root themes/) or "[default]" (Pi's own). */
export function themeSourceTag(themePath: string | undefined): "[custom]" | "[default]" {
  if (!themePath || !CUSTOM_THEMES_DIR) return "[default]";
  try {
    const real = realpathSync(themePath);
    if (real === CUSTOM_THEMES_DIR || real.startsWith(CUSTOM_THEMES_DIR + sep)) {
      return "[custom]";
    }
  } catch {
    // Path doesn't resolve (e.g. a virtual/in-memory theme) — treat as default.
  }
  return "[default]";
}

// ── Theme assignments ──────────────────────────────────────────────────────
//
// Key   = extension filename without extension (matches extensions/<key>.ts)
// Value = theme name from themes/<value>.json
//
export const THEME_MAP: Record<string, string> = {
  "agent-chain": "midnight-ocean", // deep sequential pipeline
  "agent-team": "dracula", // rich orchestration palette
  coms: "ocean-breeze", // peer-to-peer messaging, cross-boundary
  "coms-net": "ocean-breeze", // peer-to-peer messaging, cross-boundary
  "cross-agent": "ocean-breeze", // cross-boundary, connecting
  "damage-control": "gruvbox", // grounded, earthy safety
  "damage-control-continue": "gruvbox", // same family as damage-control
  minimal: "synthwave", // synthwave by default now!
  "pi-pi": "rose-pine", // warm creative meta-agent
  "plan-mode": "nord", // cool, deliberate, read-only planning
  "pure-focus": "everforest", // calm, distraction-free
  "purpose-gate": "tokyo-night", // intentional, sharp focus
  "session-replay": "catppuccin-mocha", // soft, reflective history
  "subagent-widget": "cyberpunk", // multi-agent futuristic
  "system-select": "catppuccin-mocha", // soft selection UI
  "theme-cycler": "synthwave", // neon, it's a theme tool
  tilldone: "everforest", // task-focused calm
  "tool-counter": "synthwave", // techy metrics
  "tool-counter-widget": "synthwave", // same family
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive an extension's name from a file or directory path. For folder-style
 * extensions (extensions/<name>/index.ts), the basename is "index" — fall
 * back to the parent directory name so THEME_MAP lookups still match.
 */
function baseExtensionName(rawPath: string): string {
  const trimmed = rawPath.replace(/[\\/]+$/, "");
  const base = basename(trimmed).replace(/\.[^.]+$/, "");
  return base === "index" ? basename(dirname(trimmed)) : base;
}

/** Derive the extension name (e.g. "minimal") from its import.meta.url. */
function extensionName(fileUrl: string): string {
  const filePath = fileUrl.startsWith("file://")
    ? fileURLToPath(fileUrl)
    : fileUrl;
  return baseExtensionName(filePath);
}

// ── Discovery ──────────────────────────────────────────────────────────────

/**
 * Register only the theme(s) the calling extension actually needs, instead of the whole
 * themes/ directory. theme-cycler is the one exception: its whole purpose is cycling
 * between all of them, so it registers the full set. Discovery is additive across
 * extensions — if several are stacked, each contributes its own file (or, if
 * theme-cycler is among them, the full directory wins for that launch).
 *
 * Call this once in each extension's factory body (not inside session_start —
 * resources_discover must be registered before it fires on startup).
 *
 *   export default function (pi: ExtensionAPI) {
 *     registerThemeDiscovery(pi, import.meta.url);
 *     pi.on("session_start", async (_event, ctx) => { applyExtensionTitle(ctx); ... });
 *   }
 */
export function registerThemeDiscovery(pi: ExtensionAPI, fileUrl: string): void {
  const name = extensionName(fileUrl);
  pi.on("resources_discover", async () => {
    if (name === "theme-cycler") {
      return { themePaths: [THEMES_DIR] };
    }
    const themeName = THEME_MAP[name] || "synthwave";
    return { themePaths: [join(THEMES_DIR, `${themeName}.json`)] };
  });
}

// ── Title ──────────────────────────────────────────────────────────────────

/**
 * Read process.argv to find the first -e / --extension flag value.
 *
 * When Pi is launched as:
 *   pi -e extensions/subagent-widget.ts -e extensions/pure-focus.ts
 *
 * process.argv contains those paths verbatim. Every stacked extension calls
 * this and gets the same answer ("subagent-widget"), so all setTitle calls
 * are idempotent — no shared state or deduplication needed.
 *
 * Returns null if no -e flag is present (e.g. plain `pi` with no extensions, or
 * extensions loaded via settings.json's "extensions" array instead of -e).
 */
function primaryExtensionName(): string | null {
  const argv = process.argv;
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === "-e" || argv[i] === "--extension") {
      return baseExtensionName(argv[i + 1]);
    }
  }
  return null;
}

/**
 * Set the terminal title to "π - <first-extension-name>" on session boot.
 * Reads the title from process.argv so all stacked extensions agree on the
 * same value — no coordination or shared state required. No-op if Pi wasn't
 * launched with -e/--extension (e.g. loaded via settings.json/packages instead).
 *
 * Deferred 150 ms to fire after Pi's own startup title-set. Call this in every
 * extension's session_start — unlike theme selection, title-setting is idempotent
 * across stacked extensions, so there's no collision to avoid.
 */
export function applyExtensionTitle(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const name = primaryExtensionName();
  if (!name) return;
  setTimeout(() => ctx.ui.setTitle(`π - ${name}`), 150);
}
