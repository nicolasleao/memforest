import type { Branch, TenantContext } from "@memforest/shared";
import type { Db } from "./database.js";

export async function indexBranch(
	database: Db,
	_tenant: TenantContext,
	branch: Branch,
): Promise<void> {
	const now = new Date().toISOString();
	const tags = JSON.stringify(branch.frontmatter.tags);
	const aliases = JSON.stringify(branch.frontmatter.aliases);

	database.transaction(() => {
		const existing = database
			.prepare("SELECT id FROM branches WHERE relative_path = ?")
			.get(branch.relativePath) as { id: number } | undefined;

		if (existing) {
			database
				.prepare(
					`UPDATE branches
				 SET tree_name = ?, branch_name = ?, title = ?, content = ?,
				     status = ?, tags = ?, aliases = ?, updated_at = ?, indexed_at = ?
				 WHERE id = ?`,
				)
				.run(
					branch.treeName,
					branch.branchName,
					branch.frontmatter.title,
					branch.content,
					branch.frontmatter.status,
					tags,
					aliases,
					branch.frontmatter.updated,
					now,
					existing.id,
				);
		} else {
			database
				.prepare(
					`INSERT INTO branches
				 (tree_name, branch_name, relative_path, title, content, status, tags, aliases, created_at, updated_at, indexed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					branch.treeName,
					branch.branchName,
					branch.relativePath,
					branch.frontmatter.title,
					branch.content,
					branch.frontmatter.status,
					tags,
					aliases,
					branch.frontmatter.created,
					branch.frontmatter.updated,
					now,
				);
		}

		database.prepare("DELETE FROM edges WHERE source_path = ?").run(branch.relativePath);

		const insertEdge = database.prepare(
			`INSERT OR IGNORE INTO edges (source_path, target_path, target_resolved, created_at)
			 VALUES (?, ?, 0, ?)`,
		);

		for (const link of branch.wikiLinks) {
			insertEdge.run(branch.relativePath, link, now);
		}
	})();
}

export async function removeBranchIndex(database: Db, relativePath: string): Promise<void> {
	const existing = database
		.prepare("SELECT id FROM branches WHERE relative_path = ?")
		.get(relativePath) as { id: number } | undefined;

	if (!existing) {
		return;
	}

	database.transaction(() => {
		database.prepare("DELETE FROM edges WHERE source_path = ?").run(relativePath);
		database.prepare("DELETE FROM edges WHERE target_path = ?").run(relativePath);
		database.prepare("DELETE FROM branches WHERE id = ?").run(existing.id);
	})();
}

export async function resolveEdges(database: Db): Promise<{ resolved: number; broken: number }> {
	const unresolvedTargets = database
		.prepare("SELECT DISTINCT target_path FROM edges WHERE target_resolved = 0")
		.all() as { target_path: string }[];

	let resolved = 0;
	let broken = 0;

	for (const { target_path } of unresolvedTargets) {
		const exactMatch = database
			.prepare("SELECT id FROM branches WHERE relative_path = ?")
			.get(target_path) as { id: number } | undefined;

		let found = !!exactMatch;

		if (!found) {
			const nameMatch = database
				.prepare("SELECT id FROM branches WHERE branch_name = ?")
				.get(target_path) as { id: number } | undefined;
			found = !!nameMatch;
		}

		if (found) {
			database
				.prepare("UPDATE edges SET target_resolved = 1 WHERE target_path = ?")
				.run(target_path);
			resolved++;
		} else {
			broken++;
		}
	}

	return { resolved, broken };
}

export async function reindexForest(
	database: Db,
	tenant: TenantContext,
	branches: Branch[],
): Promise<{ indexed: number; failed: number }> {
	database.transaction(() => {
		database.prepare("DELETE FROM edges").run();
		database.prepare("DELETE FROM branches").run();
	})();

	let indexed = 0;
	let failed = 0;

	for (const branch of branches) {
		try {
			await indexBranch(database, tenant, branch);
			indexed++;
		} catch {
			failed++;
		}
	}

	await resolveEdges(database);

	return { indexed, failed };
}
