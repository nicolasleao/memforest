import type { Branch, HybridSearchResult, SearchResult } from "@memforest/shared";
import type { Db } from "./database.js";

interface BranchRow {
	id: number;
	tree_name: string;
	branch_name: string;
	relative_path: string;
	title: string;
	content: string;
	status: string;
	tags: string;
	aliases: string;
	created_at: string;
	updated_at: string;
	indexed_at: string;
}

interface FTSRow extends BranchRow {
	rank: number;
}

function rowToBranch(row: BranchRow): Branch {
	return {
		treeName: row.tree_name,
		branchName: row.branch_name,
		relativePath: row.relative_path,
		frontmatter: {
			title: row.title,
			created: row.created_at,
			updated: row.updated_at,
			tags: JSON.parse(row.tags) as string[],
			aliases: JSON.parse(row.aliases) as string[],
			status: row.status as Branch["frontmatter"]["status"],
		},
		content: row.content,
		wikiLinks: [],
	};
}

function escapeQuery(query: string): string {
	const terms = query.trim().split(/\s+/);
	return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(" OR ");
}

export async function searchFTS(
	database: Db,
	query: string,
	limit?: number,
): Promise<SearchResult[]> {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return [];
	}

	const maxResults = limit ?? 20;
	const escapedQuery = escapeQuery(trimmed);

	try {
		const rows = database
			.prepare(
				`SELECT b.*, fts.rank
			 FROM fts_branches fts
			 JOIN branches b ON b.id = fts.rowid
			 WHERE fts_branches MATCH ?
			 ORDER BY fts.rank
			 LIMIT ?`,
			)
			.all(escapedQuery, maxResults) as FTSRow[];

		return rows.map((row) => ({
			branch: rowToBranch(row),
			score: 1 / (1 + Math.abs(row.rank)),
			mode: "fts" as const,
		}));
	} catch {
		return [];
	}
}

export function searchGraph(database: Db, startPath: string, depth?: number): SearchResult[] {
	const maxDepth = Math.min(depth ?? 2, 5);

	const startExists = database
		.prepare("SELECT id FROM branches WHERE relative_path = ?")
		.get(startPath) as { id: number } | undefined;

	if (!startExists) {
		return [];
	}

	const visited = new Set<string>([startPath]);
	const results: SearchResult[] = [];

	let currentLevel = [startPath];

	for (let hop = 1; hop <= maxDepth; hop++) {
		const nextLevel: string[] = [];

		for (const nodePath of currentLevel) {
			const outgoing = database
				.prepare("SELECT target_path FROM edges WHERE source_path = ? AND target_resolved = 1")
				.all(nodePath) as { target_path: string }[];

			const incoming = database
				.prepare("SELECT source_path FROM edges WHERE target_path = ? AND target_resolved = 1")
				.all(nodePath) as { source_path: string }[];

			const neighbors = [
				...outgoing.map((row) => row.target_path),
				...incoming.map((row) => row.source_path),
			];

			for (const neighborPath of neighbors) {
				if (visited.has(neighborPath)) {
					continue;
				}
				visited.add(neighborPath);

				const row = database
					.prepare("SELECT * FROM branches WHERE relative_path = ?")
					.get(neighborPath) as BranchRow | undefined;

				if (row) {
					results.push({
						branch: rowToBranch(row),
						score: 1 / (hop + 1),
						mode: "graph",
					});
					nextLevel.push(neighborPath);
				}
			}
		}

		if (nextLevel.length === 0) {
			break;
		}
		currentLevel = nextLevel;
	}

	return results;
}

export async function searchHybrid(
	database: Db,
	query: string,
	options?: {
		limit?: number;
		ftsWeight?: number;
		graphWeight?: number;
	},
): Promise<HybridSearchResult> {
	const limit = options?.limit ?? 20;
	const ftsWeight = options?.ftsWeight ?? 0.7;
	const graphWeight = options?.graphWeight ?? 0.3;

	const ftsResults = await searchFTS(database, query);

	let graphResults: SearchResult[] = [];
	if (ftsResults.length > 0) {
		const topPath = ftsResults[0].branch.relativePath;
		graphResults = searchGraph(database, topPath);
	}

	const scoreMap = new Map<
		string,
		{ ftsScore: number; graphScore: number; branch: Branch; bestMode: "fts" | "graph" }
	>();

	for (const result of ftsResults) {
		const key = result.branch.relativePath;
		const entry = scoreMap.get(key) ?? {
			ftsScore: 0,
			graphScore: 0,
			branch: result.branch,
			bestMode: "fts" as const,
		};
		entry.ftsScore = result.score;
		entry.bestMode = "fts";
		scoreMap.set(key, entry);
	}

	for (const result of graphResults) {
		const key = result.branch.relativePath;
		const entry = scoreMap.get(key) ?? {
			ftsScore: 0,
			graphScore: 0,
			branch: result.branch,
			bestMode: "graph" as const,
		};
		entry.graphScore = result.score;
		if (result.score > entry.ftsScore) {
			entry.bestMode = "graph";
		}
		scoreMap.set(key, entry);
	}

	const merged: SearchResult[] = [];
	for (const [, entry] of scoreMap) {
		const combinedScore = entry.ftsScore * ftsWeight + entry.graphScore * graphWeight;
		merged.push({
			branch: entry.branch,
			score: combinedScore,
			mode: entry.bestMode,
		});
	}

	merged.sort((a, b) => b.score - a.score);

	const limited = merged.slice(0, limit);

	let totalFTS = 0;
	let totalGraph = 0;
	for (const result of limited) {
		if (result.mode === "fts") {
			totalFTS++;
		} else {
			totalGraph++;
		}
	}

	return {
		results: limited,
		query,
		totalFTS,
		totalGraph,
	};
}
