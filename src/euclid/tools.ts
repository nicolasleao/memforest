import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import {
	branchExists,
	createBranch,
	deleteBranch,
	listBranches,
	readBranch,
	updateBranch,
} from "@memforest/forest";
import {
	indexBranch,
	reindexForest,
	removeBranchIndex,
	resolveEdges,
	searchFTS,
	searchGraph,
	searchHybrid,
} from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";
import { Type } from "typebox";
import type { Db } from "../mycelium/database.js";

function textResult(text: string): AgentToolResult<Record<string, never>> {
	return { content: [{ type: "text", text }], details: {} };
}

function parsePath(raw: string): { treeName: string; branchName: string } {
	if (raw.includes("/")) {
		const [treeName, ...rest] = raw.split("/");
		return { treeName, branchName: rest.join("/") };
	}
	return { treeName: "general", branchName: raw };
}

const SearchParams = Type.Object({
	query: Type.String({ description: "Search query or start path for graph mode" }),
	mode: Type.Optional(
		Type.Union([Type.Literal("fts"), Type.Literal("graph"), Type.Literal("hybrid")], {
			description: "Search mode (default: hybrid)",
		}),
	),
	limit: Type.Optional(Type.Number({ description: "Max results to return (default: 20)" })),
});

const UpsertParams = Type.Object({
	path: Type.String({ description: "Branch path: tree/branch or just branch" }),
	content: Type.String({ description: "Markdown content for the branch" }),
	tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for the branch" })),
	status: Type.Optional(
		Type.String({ description: "Branch status: seed, growing, mature, stale, archived" }),
	),
});

const PathParams = Type.Object({
	path: Type.String({ description: "Branch path: tree/branch or just branch" }),
});

const ListParams = Type.Object({
	tree: Type.Optional(Type.String({ description: "Filter by tree name" })),
});

const EmptyParams = Type.Object({});

export function createEuclidTools(tenant: TenantContext, db: Db): AgentTool[] {
	const forestSearch: AgentTool<typeof SearchParams> = {
		name: "forest_search",
		label: "Search Forest",
		description:
			"Search the knowledge forest using full-text search, graph traversal, or hybrid mode.",
		parameters: SearchParams,
		execute: async (_toolCallId, params) => {
			const mode = params.mode ?? "hybrid";
			const limit = params.limit ?? 20;

			if (mode === "fts") {
				const results = await searchFTS(db, params.query, limit);
				return textResult(JSON.stringify(results, null, 2));
			}

			if (mode === "graph") {
				const results = searchGraph(db, params.query, limit);
				return textResult(JSON.stringify(results, null, 2));
			}

			const results = await searchHybrid(db, params.query, { limit });
			return textResult(JSON.stringify(results, null, 2));
		},
	};

	const forestUpsert: AgentTool<typeof UpsertParams> = {
		name: "forest_upsert",
		label: "Upsert Branch",
		description:
			"Create or update a branch in the forest. Path format: tree/branch or just branch (defaults to general tree).",
		parameters: UpsertParams,
		execute: async (_toolCallId, params) => {
			const { treeName, branchName } = parsePath(params.path);
			const exists = branchExists(tenant, treeName, branchName);
			const frontmatter: Record<string, unknown> = {};
			if (params.tags) frontmatter.tags = params.tags;
			if (params.status) frontmatter.status = params.status;

			const branch = exists
				? updateBranch(tenant, treeName, branchName, params.content, frontmatter)
				: createBranch(tenant, treeName, branchName, params.content, frontmatter);

			await indexBranch(db, tenant, branch);
			await resolveEdges(db);

			const action = exists ? "updated" : "created";
			return textResult(JSON.stringify({ action, path: `${treeName}/${branchName}` }, null, 2));
		},
	};

	const forestRead: AgentTool<typeof PathParams> = {
		name: "forest_read",
		label: "Read Branch",
		description: "Read the full content and metadata of a branch.",
		parameters: PathParams,
		execute: async (_toolCallId, params) => {
			const { treeName, branchName } = parsePath(params.path);
			const branch = readBranch(tenant, treeName, branchName);
			return textResult(
				JSON.stringify(
					{
						path: branch.relativePath,
						frontmatter: branch.frontmatter,
						content: branch.content,
						wikiLinks: branch.wikiLinks,
					},
					null,
					2,
				),
			);
		},
	};

	const forestList: AgentTool<typeof ListParams> = {
		name: "forest_list",
		label: "List Branches",
		description: "List all branches in the forest, optionally filtered by tree.",
		parameters: ListParams,
		execute: async (_toolCallId, params) => {
			const branches = listBranches(tenant, params.tree);
			const summaries = branches.map((b) => ({
				relativePath: b.relativePath,
				title: b.frontmatter.title,
				status: b.frontmatter.status,
				tags: b.frontmatter.tags,
			}));
			return textResult(JSON.stringify(summaries, null, 2));
		},
	};

	const forestHealth: AgentTool<typeof EmptyParams> = {
		name: "forest_health",
		label: "Forest Health",
		description:
			"Compute a health report for the forest: branch counts, edges, orphans, broken links, stale content.",
		parameters: EmptyParams,
		execute: async () => {
			const branches = listBranches(tenant);
			const indexedCount = db.prepare("SELECT COUNT(*) as count FROM branches").get() as {
				count: number;
			};
			const totalEdges = db.prepare("SELECT COUNT(*) as count FROM edges").get() as {
				count: number;
			};
			const brokenLinks = db
				.prepare("SELECT target_path FROM edges WHERE target_resolved = 0")
				.all() as { target_path: string }[];
			const orphans = db
				.prepare(
					"SELECT relative_path FROM branches WHERE relative_path NOT IN (SELECT source_path FROM edges) AND relative_path NOT IN (SELECT target_path FROM edges)",
				)
				.all() as { relative_path: string }[];
			const staleCount = db
				.prepare("SELECT COUNT(*) as count FROM branches WHERE status = 'stale'")
				.get() as { count: number };

			const report = {
				totalBranches: branches.length,
				indexedCount: indexedCount.count,
				unindexedCount: branches.length - indexedCount.count,
				totalEdges: totalEdges.count,
				brokenLinks: brokenLinks.map((r) => r.target_path),
				orphanBranches: orphans.map((r) => r.relative_path),
				staleCount: staleCount.count,
			};

			return textResult(JSON.stringify(report, null, 2));
		},
	};

	const forestReindex: AgentTool<typeof EmptyParams> = {
		name: "forest_reindex",
		label: "Reindex Forest",
		description: "Rebuild the entire search index (FTS + graph edges).",
		parameters: EmptyParams,
		execute: async () => {
			const branches = listBranches(tenant);
			const result = await reindexForest(db, tenant, branches);
			return textResult(JSON.stringify(result, null, 2));
		},
	};

	const forestDelete: AgentTool<typeof PathParams> = {
		name: "forest_delete",
		label: "Delete Branch",
		description: "Delete a branch from the forest and remove it from the index.",
		parameters: PathParams,
		execute: async (_toolCallId, params) => {
			const { treeName, branchName } = parsePath(params.path);
			const relativePath = `${treeName}/${branchName}`;
			deleteBranch(tenant, treeName, branchName);
			await removeBranchIndex(db, relativePath);
			return textResult(JSON.stringify({ deleted: relativePath }, null, 2));
		},
	};

	return [
		forestSearch,
		forestUpsert,
		forestRead,
		forestList,
		forestHealth,
		forestReindex,
		forestDelete,
	];
}
