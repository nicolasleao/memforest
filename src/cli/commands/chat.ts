import * as readline from "node:readline";
import { createEuclidSession } from "@memforest/euclid";
import { resolveActiveTenant } from "@memforest/shared";
import chalk from "chalk";
import type { Command } from "commander";
import { printBanner } from "../banner.js";
import { createSpinner, getToolStart, renderMarkdown } from "../render.js";

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerChat(program: Command): void {
	program
		.command("chat")
		.description("Start an interactive chat session with Euclid")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (opts: { model?: string }) => {
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

				process.stderr.write(
					`${chalk.dim("Euclid is ready. Type your message, or 'exit' to quit.")}\n\n`,
				);

				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stderr,
					prompt: chalk.green("euclid> "),
				});

				rl.prompt();

				rl.on("line", async (line) => {
					const input = line.trim();
					if (!input) {
						rl.prompt();
						return;
					}
					if (input === "exit" || input === "quit" || input === "/exit" || input === "/quit") {
						rl.close();
						return;
					}

					const spinner = createSpinner("Thinking...");
					spinner.start();

					// Subscribe to events — show tool calls while waiting
					const unsubscribe = euclidSession.subscribe((event: unknown) => {
						const tool = getToolStart(event);
						if (tool) {
							spinner.stop();
							process.stderr.write(`  ${chalk.dim(`⚙ ${tool.display}`)}\n`);
							spinner.start();
						}
					});

					try {
						const fullResponse = await euclidSession.prompt(input);
						unsubscribe();
						spinner.stop();

						if (fullResponse?.trim()) {
							const rendered = await renderMarkdown(fullResponse, width - 2);
							process.stdout.write(`\n${rendered}\n\n`);
						}
					} catch (error) {
						unsubscribe();
						spinner.stop();
						process.stderr.write(
							chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}\n\n`),
						);
					}

					rl.prompt();
				});

				rl.on("close", async () => {
					process.stderr.write(`${chalk.dim("\nGoodbye.")}\n`);
					const forceExit = setTimeout(() => process.exit(0), 1500);
					try {
						await euclidSession.dispose();
					} finally {
						clearTimeout(forceExit);
						process.exit(0);
					}
				});
			} catch (error) {
				process.stderr.write(
					chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}\n`),
				);
				process.exit(1);
			}
		});
}
