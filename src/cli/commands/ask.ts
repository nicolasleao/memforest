import { createEuclidSession } from "@memforest/euclid";
import { resolveActiveTenant } from "@memforest/shared";
import chalk from "chalk";
import type { Command } from "commander";
import { printBanner } from "../banner.js";
import { createSpinner, getToolStart, renderMarkdown } from "../render.js";

export function registerAsk(program: Command): void {
	program
		.command("ask")
		.description("Ask Euclid a question about your forest")
		.argument("<question>", "Question to ask")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (question: string, opts: { model?: string }) => {
			try {
				const tenant = resolveActiveTenant();
				const width = process.stdout.columns || 80;

				printBanner(tenant.name);
				process.stderr.write(`${chalk.dim("Starting Euclid session...")}\n`);

				const euclidSession = await createEuclidSession({
					tenant,
					mode: "chat",
					model: opts.model,
				});

				const spinner = createSpinner("Thinking...");
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
					const response = await euclidSession.prompt(question);
					unsubscribe();
					spinner.stop();

					if (response?.trim()) {
						const rendered = await renderMarkdown(response, width - 2);
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
