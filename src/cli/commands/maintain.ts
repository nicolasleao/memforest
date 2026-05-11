import { MAINTENANCE_PROMPT, createEuclidSession } from "@memforest/euclid";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";

export function registerMaintain(program: Command): void {
	program
		.command("maintain")
		.description("Run autonomous forest maintenance with Euclid")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (opts: { model?: string }) => {
			try {
				const tenant = resolveActiveTenant();
				process.stderr.write(`Starting maintenance cycle for forest '${tenant.name}'...\n`);

				const euclidSession = await createEuclidSession({
					tenant,
					mode: "maintain",
					model: opts.model,
				});

				try {
					const report = await euclidSession.prompt(MAINTENANCE_PROMPT);
					process.stdout.write(`${report}\n`);
				} finally {
					await euclidSession.dispose();
				}
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
