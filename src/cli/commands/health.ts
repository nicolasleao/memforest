import { listBranches } from "@memforest/forest";
import { closeDatabase, openDatabase } from "@memforest/mycelium";
import type { HealthReport } from "@memforest/shared";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { Command } from "commander";

export function registerHealth(program: Command): void {
	program
		.command("health")
		.description("Show health report for the active forest")
		.option("--json", "Output as JSON")
		.action(async (opts: { json?: boolean }) => {
			try {
				const tenant = resolveActiveTenant();
				const branches = listBranches(tenant);
				const db = openDatabase(tenant);

				try {
					const indexedRow = db.prepare("SELECT COUNT(*) as count FROM branches").get() as {
						count: number;
					};
					const indexedCount = indexedRow.count;

					const edgesRow = db.prepare("SELECT COUNT(*) as count FROM edges").get() as {
						count: number;
					};
					const totalEdges = edgesRow.count;

					const brokenRows = db
						.prepare("SELECT target_path FROM edges WHERE target_resolved = 0")
						.all() as { target_path: string }[];
					const brokenLinks = brokenRows.map((r) => r.target_path);

					const staleRow = db
						.prepare("SELECT COUNT(*) as count FROM branches WHERE status = 'stale'")
						.get() as { count: number };
					const staleCount = staleRow.count;

					// Orphan branches: indexed branches with no edges (neither source nor target)
					const orphanRows = db
						.prepare(
							`SELECT relative_path FROM branches
							 WHERE relative_path NOT IN (SELECT source_path FROM edges)
							   AND relative_path NOT IN (SELECT target_path FROM edges)`,
						)
						.all() as { relative_path: string }[];
					const orphanBranches = orphanRows.map((r) => r.relative_path);

					const report: HealthReport = {
						totalBranches: branches.length,
						totalEdges,
						orphanBranches,
						brokenLinks,
						staleCount,
						indexedCount,
						unindexedCount: branches.length - indexedCount,
					};

					if (opts.json) {
						process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
					} else {
						process.stdout.write(`Forest Health: ${tenant.name}\n`);
						process.stdout.write(
							`Branches: ${report.totalBranches}${report.unindexedCount > 0 ? ` (${report.unindexedCount} unindexed)` : ""}\n`,
						);
						process.stdout.write(
							`Edges: ${report.totalEdges}${report.brokenLinks.length > 0 ? ` (${report.brokenLinks.length} broken)` : ""}\n`,
						);
						process.stdout.write(`Orphans: ${report.orphanBranches.length}\n`);
						process.stdout.write(`Stale: ${report.staleCount}\n`);
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
