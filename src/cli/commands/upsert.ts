import { branchExists, createBranch, updateBranch } from "@memforest/forest";
import { closeDatabase, indexBranch, openDatabase, resolveEdges } from "@memforest/mycelium";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { BranchFrontmatter } from "@memforest/shared";
import type { Command } from "commander";

function parseBranchPath(name: string): { treeName: string; branchName: string } {
	const slashIndex = name.indexOf("/");
	if (slashIndex === -1) {
		return { treeName: "general", branchName: name };
	}
	return {
		treeName: name.slice(0, slashIndex),
		branchName: name.slice(slashIndex + 1),
	};
}

export function registerUpsert(program: Command): void {
	program
		.command("upsert")
		.description("Create or update a branch")
		.argument("<name>", 'Branch path (e.g. "tree/branch" or "branch")')
		.argument("<content>", "Markdown content")
		.option(
			"-t, --tag <tag>",
			"Add tag (repeatable)",
			(val: string, acc: string[]) => {
				acc.push(val);
				return acc;
			},
			[] as string[],
		)
		.option("-s, --status <status>", "Branch status (seed|growing|mature|stale|archived)")
		.action(
			async (
				name: string,
				content: string,
				opts: { tag: string[]; status?: string },
				command: Command,
			) => {
				try {
					const tenant = resolveActiveTenant(
						command.optsWithGlobals().forest as string | undefined,
					);
					const { treeName, branchName } = parseBranchPath(name);
					const db = openDatabase(tenant);

					try {
						const frontmatterOpts: Partial<BranchFrontmatter> = {};
						if (opts.tag.length > 0) {
							frontmatterOpts.tags = opts.tag;
						}
						if (opts.status) {
							frontmatterOpts.status = opts.status as BranchFrontmatter["status"];
						}

						const isUpdate = branchExists(tenant, treeName, branchName);
						const branch = isUpdate
							? updateBranch(tenant, treeName, branchName, content, frontmatterOpts)
							: createBranch(tenant, treeName, branchName, content, frontmatterOpts);

						await indexBranch(db, tenant, branch);
						await resolveEdges(db);
						process.stderr.write(`${isUpdate ? "Updated" : "Created"} ${treeName}/${branchName}\n`);
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
			},
		);
}
