import { closeDatabase, openDatabase, searchHybrid } from "@memforest/mycelium";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";

export function registerAsk(program: Command): void {
	program
		.command("ask")
		.description("Ask a question against the active forest")
		.argument("<question>", "Question to ask")
		.option("--json", "Output as JSON")
		.action(async (question: string, opts: { json?: boolean }) => {
			try {
				const tenant = resolveActiveTenant();
				const db = openDatabase(tenant);

				try {
					const hybrid = await searchHybrid(db, question, { limit: 5 });
					const results = hybrid.results;

					if (opts.json) {
						process.stdout.write(`${JSON.stringify(hybrid, null, 2)}\n`);
						return;
					}

					if (results.length === 0) {
						process.stderr.write(`No results found for '${question}'\n`);
						process.stderr.write("(Full synthesis available in a future version)\n");
						return;
					}

					process.stdout.write(`Top results for: ${question}\n\n`);

					for (const result of results) {
						const snippet =
							result.branch.content.length > 200
								? `${result.branch.content.slice(0, 200)}...`
								: result.branch.content;
						process.stdout.write(
							`--- ${result.branch.relativePath} (score: ${result.score.toFixed(2)}, via: ${result.mode}) ---\n`,
						);
						process.stdout.write(`${snippet.trim()}\n\n`);
					}

					process.stdout.write("(Full synthesis available in a future version)\n");
				} finally {
					closeDatabase(db);
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
