import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";
import { TUI_VIEWS, launchTUI } from "../tui/index.js";
import type { TUIView } from "../tui/index.js";

export function registerTui(program: Command): void {
	program
		.command("tui")
		.description("Launch the interactive TUI")
		.option("-v, --view <view>", "Start on a specific view (chat|browse|graph|health)")
		.action(async (opts: { view?: string }) => {
			try {
				if (!process.stdout.isTTY) {
					process.stderr.write("TUI requires an interactive terminal.\n");
					process.exit(1);
				}

				if (opts.view && !TUI_VIEWS.includes(opts.view as TUIView)) {
					process.stderr.write(
						`Invalid view "${opts.view}". Valid views: ${TUI_VIEWS.join(", ")}\n`,
					);
					process.exit(1);
				}

				const tenant = resolveActiveTenant();
				const initialView = opts.view as TUIView | undefined;
				await launchTUI(tenant, initialView);
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
