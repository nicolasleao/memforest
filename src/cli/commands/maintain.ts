import { MAINTENANCE_PROMPT, createEuclidSession } from "@memforest/euclid";
import { resolveActiveTenant } from "@memforest/shared";
import chalk from "chalk";
import type { Command } from "commander";
import { printBanner } from "../banner.js";
import { createSpinner, getToolStart, renderMarkdown } from "../render.js";

export function registerMaintain(program: Command): void {
	program
		.command("maintain")
		.description("Run autonomous forest maintenance with Euclid")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (opts: { model?: string }) => {
			try {
				const tenant = resolveActiveTenant();
				const width = process.stdout.columns || 80;

				printBanner(tenant.name);
				process.stderr.write(`${chalk.dim("Starting maintenance cycle...")}\n`);

				const euclidSession = await createEuclidSession({
					tenant,
					mode: "maintain",
					model: opts.model,
				});

				const spinner = createSpinner("Running maintenance...");
				spinner.start();

				const unsubscribe = euclidSession.subscribe((event: unknown) => {
					const tool = getToolStart(event);
					if (tool) {
						spinner.stop();
						process.stderr.write(`  ${chalk.dim(`⚙ ${tool.display}`)}\n`);
						spinner.start();
					}
				});

				try {
					const report = await euclidSession.prompt(MAINTENANCE_PROMPT);
					unsubscribe();
					spinner.stop();

					if (report?.trim()) {
						const rendered = renderMarkdown(report, width - 2);
						process.stdout.write(`\n${rendered}\n\n`);
					}
				} catch (error) {
					unsubscribe();
					spinner.stop();
					throw error;
				} finally {
					const forceExit = setTimeout(() => process.exit(0), 1500);
					try {
						await euclidSession.dispose();
					} finally {
						clearTimeout(forceExit);
					}
				}
			} catch (error) {
				process.stderr.write(
					chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}\n`),
				);
				process.exit(1);
			}
		});
}
