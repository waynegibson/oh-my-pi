/**
 * theme-map.ts — Per-extension default theme assignments
 *
 * Themes live in the repo-root themes/ directory (sibling of extensions/), not
 * under .pi/ or ~/.pi/agent/, so Pi never auto-discovers them. Extensions must
 * call registerThemeDiscovery(pi) once in their factory body to tell Pi where
 * to find them (via the resources_discover event), then applyExtensionTheme /
 * applyExtensionDefaults in session_start to actually switch to the mapped theme.
 *
 * Available themes (themes/):
 *   catppuccin-mocha · cyberpunk · dracula · everforest · gruvbox
 *   midnight-ocean   · nord      · ocean-breeze · rose-pine
 *   synthwave        · tokyo-night
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { basename, dirname, join } from "path";
import { fileURLToPath } from "url";

// Absolute path to the repo-root themes/ directory, resolved relative to this
// file (not ctx.cwd), so it works regardless of where pi is launched from.
const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "themes");

/**
 * Tell Pi to load themes from the repo-root themes/ directory.
 * Call this once in each extension's factory body (not inside session_start —
 * resources_discover must be registered before it fires on startup).
 *
 *   export default function (pi: ExtensionAPI) {
 *     registerThemeDiscovery(pi);
 *     pi.on("session_start", async (_event, ctx) => { applyExtensionDefaults(import.meta.url, ctx); ... });
 *   }
 */
export function registerThemeDiscovery(pi: ExtensionAPI): void {
  pi.on("resources_discover", async () => ({ themePaths: [THEMES_DIR] }));
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

// ── Helpers ───────────────────────────────────────────────────────────────

/** Derive the extension name (e.g. "minimal") from its import.meta.url. */
function extensionName(fileUrl: string): string {
  const filePath = fileUrl.startsWith("file://")
    ? fileURLToPath(fileUrl)
    : fileUrl;
  return basename(filePath).replace(/\.[^.]+$/, "");
}

// ── Theme ──────────────────────────────────────────────────────────────────

/**
 * Apply the mapped theme for an extension on session boot.
 *
 * @param fileUrl   Pass `import.meta.url` from the calling extension file.
 * @param ctx       The ExtensionContext from the session_start handler.
 *
 * Deferred 150 ms: `resources_discover` (which registers our repo-root themes/
 * directory via registerThemeDiscovery) fires AFTER `session_start` in Pi's
 * startup lifecycle, so calling ctx.ui.setTheme() synchronously here would
 * always fail — the theme isn't registered yet. Waiting lets resources_discover
 * complete first. Because of this, the call is fire-and-forget (no success/failure
 * return value is available to the caller).
 */
export function applyExtensionTheme(fileUrl: string, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  const name = extensionName(fileUrl);

  // If there are multiple extensions stacked in a single `pi -e ... -e ...` launch,
  // they each fire session_start and try to apply their own mapped theme. The LAST
  // one to fire would normally win. We want the primary extension (first in the
  // -e list) to dictate the theme instead, so secondary extensions skip entirely.
  const primaryExt = primaryExtensionName();
  if (primaryExt && primaryExt !== name) {
    return;
  }

  const themeName = THEME_MAP[name] || "synthwave";

  setTimeout(() => {
    const result = ctx.ui.setTheme(themeName);
    if (!result.success && themeName !== "synthwave") {
      ctx.ui.setTheme("synthwave");
    }
  }, 150);
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
 * Returns null if no -e flag is present (e.g. plain `pi` with no extensions).
 */
function primaryExtensionName(): string | null {
  const argv = process.argv;
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === "-e" || argv[i] === "--extension") {
      return basename(argv[i + 1]).replace(/\.[^.]+$/, "");
    }
  }
  return null;
}

/**
 * Set the terminal title to "π - <first-extension-name>" on session boot.
 * Reads the title from process.argv so all stacked extensions agree on the
 * same value — no coordination or shared state required.
 *
 * Deferred 150 ms to fire after Pi's own startup title-set.
 */
function applyExtensionTitle(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const name = primaryExtensionName();
  if (!name) return;
  setTimeout(() => ctx.ui.setTitle(`π - ${name}`), 150);
}

// ── Combined default ───────────────────────────────────────────────────────

/**
 * Apply both the mapped theme AND the terminal title for an extension.
 * Drop-in replacement for applyExtensionTheme — call this in every session_start.
 * Still requires registerThemeDiscovery(pi) in the factory body (see above) —
 * this alone does not register the repo-root themes/ directory with Pi.
 *
 * Usage:
 *   import { applyExtensionDefaults, registerThemeDiscovery } from "./theme-map.ts";
 *
 *   export default function (pi: ExtensionAPI) {
 *     registerThemeDiscovery(pi);
 *     pi.on("session_start", async (_event, ctx) => {
 *       applyExtensionDefaults(import.meta.url, ctx);
 *       // ... rest of handler
 *     });
 *   }
 */
export function applyExtensionDefaults(
  fileUrl: string,
  ctx: ExtensionContext,
): void {
  applyExtensionTheme(fileUrl, ctx);
  applyExtensionTitle(ctx);
}
