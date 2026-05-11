import { createForest } from "@memforest/forest";
import { closeDatabase, initDatabase } from "@memforest/mycelium";
import { MemforestError } from "@memforest/shared";
import type { Command } from "commander";

export function registerInit(program: Command): void {
	program
		.command("init")
		.description("Create a new forest")
		.argument("<name>", "Forest name")
		.option("-d, --description <text>", "Optional description")
		.action(async (name: string, opts: { description?: string }) => {
			try {
				const tenant = createForest(name);
				const db = initDatabase(tenant);
				try {
					if (opts.description) {
						// Description stored in forest.toml via createForest defaults;
						// no additional action needed beyond init
					}
				} finally {
					closeDatabase(db);
				}
				process.stderr.write(`Forest '${name}' created at ${tenant.forestPath}\n`);
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
