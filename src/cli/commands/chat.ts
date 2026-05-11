import * as readline from "node:readline";
import { createEuclidSession } from "@memforest/euclid";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";

export function registerChat(program: Command): void {
	program
		.command("chat")
		.description("Start an interactive chat session with Euclid")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (opts: { model?: string }) => {
			try {
				const tenant = resolveActiveTenant();
				process.stderr.write(`Starting Euclid session for forest '${tenant.name}'...\n`);

				const euclidSession = await createEuclidSession({
					tenant,
					mode: "chat",
					model: opts.model,
				});

				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stderr,
					prompt: "euclid> ",
				});

				process.stderr.write("Euclid is ready. Type your message, or 'exit' to quit.\n\n");
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

					try {
						const response = await euclidSession.prompt(input);
						process.stdout.write(`${response}\n\n`);
					} catch (error) {
						process.stderr.write(
							`Error: ${error instanceof Error ? error.message : String(error)}\n`,
						);
					}
					rl.prompt();
				});

				rl.on("close", async () => {
					process.stderr.write("\nEnding Euclid session...\n");
					await euclidSession.dispose();
				});
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
