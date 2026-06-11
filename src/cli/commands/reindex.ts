import { listBranches } from "@memforest/forest";
import { closeDatabase, openDatabase, reindexForest } from "@memforest/mycelium";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";

export function registerReindex(program: Command): void {
	program
		.command("reindex")
		.description("Reindex all branches in the active forest")
		.action(async (_opts: unknown, command: Command) => {
			try {
				const tenant = resolveActiveTenant(command.optsWithGlobals().forest as string | undefined);
				const branches = listBranches(tenant);
				const db = openDatabase(tenant);

				try {
					process.stderr.write(`Reindexing ${branches.length} branches...\n`);
					const result = await reindexForest(db, tenant, branches);
					process.stderr.write(
						`Reindex complete. ${result.indexed} indexed, ${result.failed} failed.\n`,
					);

					if (result.failed > 0) {
						process.exit(1);
					}
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
