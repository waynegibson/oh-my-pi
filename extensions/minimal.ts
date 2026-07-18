
/**
 * Minimal — Model name + context meter in a compact footer
 *
 * Replaces Pi's built-in footer with a single line: model ID + a 10-block
 * context usage bar, e.g. ` mlx-community/Qwen3.6-35B-A3B-6bit[###-------] 30% `.
 * Mapped to the "synthwave" theme via registerThemeDiscovery (lib/theme-map.ts), which
 * registers only this extension's assigned theme file, not the whole themes/ directory.
 *
 * Usage: pi -e extensions/minimal.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { applyExtensionTitle, registerThemeDiscovery } from "../lib/theme-map.ts";

export default function (pi: ExtensionAPI) {
  registerThemeDiscovery(pi, import.meta.url);

  pi.on("session_start", async (_event, ctx) => {
    applyExtensionTitle(ctx);
    ctx.ui.setFooter((_tui, theme, _footerData) => ({
      dispose: () => {},
      invalidate() {},
      render(width: number): string[] {
        const model = ctx.model?.id || "no-model";
        const usage = ctx.getContextUsage();
        const pct = usage && usage.percent !== null ? usage.percent : 0;
        const filled = Math.round(pct / 10);
        const bar = "#".repeat(filled) + "-".repeat(10 - filled);

        const left = theme.fg("dim", ` ${model}`);
        const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
        const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

        return [truncateToWidth(left + pad + right, width)];
      },
    }));
  });
}