import { listForests } from "@memforest/forest";
import { closeDatabase, openDatabase } from "@memforest/mycelium";
import { loadGlobalConfig } from "@memforest/shared";
import type { Command } from "commander";

export function registerList(program: Command): void {
	program
		.command("list")
		.description("List all forests")
		.action(async () => {
			const forests = listForests();
			if (forests.length === 0) {
				process.stderr.write("No forests found. Run 'memforest init <name>' to create one.\n");
				return;
			}

			const globalConfig = loadGlobalConfig();
			const activeForest = globalConfig.activeForest;

			const header = `${"NAME".padEnd(20)}${"BRANCHES".padEnd(12)}ACTIVE`;
			process.stdout.write(`${header}\n`);

			for (const tenant of forests) {
				let branchCount = 0;
				try {
					const db = openDatabase(tenant);
					try {
						const row = db.prepare("SELECT COUNT(*) as count FROM branches").get() as {
							count: number;
						};
						branchCount = row.count;
					} finally {
						closeDatabase(db);
					}
				} catch {
					// DB might not exist yet — show 0
				}

				const isActive = tenant.name === activeForest;
				const line = `${tenant.name.padEnd(20)}${String(branchCount).padEnd(12)}${isActive ? "*" : ""}`;
				process.stdout.write(`${line}\n`);
			}
		});
}
