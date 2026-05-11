import type { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createForest } from "@memforest/forest";
import {
	closeDatabase,
	indexBranch,
	initDatabase,
	resolveEdges,
	searchFTS,
	searchGraph,
	searchHybrid,
} from "@memforest/mycelium";
import type { Branch, TenantContext } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
let database: Database;
const originalEnv = process.env.MEMFOREST_HOME;

function makeBranch(
	treeName: string,
	branchName: string,
	content: string,
	wikiLinks: string[] = [],
	tags: string[] = [],
): Branch {
	return {
		treeName,
		branchName,
		relativePath: `${treeName}/${branchName}`,
		frontmatter: {
			title: branchName,
			created: "2026-01-01T00:00:00.000Z",
			updated: "2026-01-01T00:00:00.000Z",
			tags,
			aliases: [],
			status: "seed",
		},
		content,
		wikiLinks,
	};
}

async function seedTestData(): Promise<void> {
	const branches: Branch[] = [
		makeBranch(
			"domains",
			"auth",
			"Authentication and authorization patterns for securing APIs",
			["domains/sessions", "domains/jwt"],
			["security", "auth"],
		),
		makeBranch(
			"domains",
			"sessions",
			"Session management strategies including stateless tokens",
			["domains/auth"],
			["security"],
		),
		makeBranch(
			"domains",
			"jwt",
			"JSON Web Tokens for stateless authentication",
			["domains/auth"],
			["tokens"],
		),
		makeBranch(
			"ideas",
			"caching",
			"Caching strategies for high-performance applications",
			[],
			["performance"],
		),
		makeBranch(
			"ideas",
			"graphql",
			"GraphQL API design patterns and best practices",
			["domains/auth"],
			["api"],
		),
	];

	for (const branch of branches) {
		await indexBranch(database, tenant, branch);
	}
	await resolveEdges(database);
}

beforeEach(async () => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
	process.env.MEMFOREST_HOME = tempDir;
	tenant = createForest("testforest", tempDir);
	database = initDatabase(tenant);
	await seedTestData();
});

afterEach(() => {
	closeDatabase(database);
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
});

describe("searchFTS", () => {
	it("returns branches containing query term", async () => {
		const results = await searchFTS(database, "authentication");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].mode).toBe("fts");
		expect(results[0].score).toBeGreaterThan(0);
		expect(results[0].score).toBeLessThanOrEqual(1);
	});

	it("returns empty array for nonexistent term", async () => {
		const results = await searchFTS(database, "nonexistent gibberish xyz");
		expect(results).toEqual([]);
	});

	it("returns empty array for empty query", async () => {
		const results = await searchFTS(database, "");
		expect(results).toEqual([]);
	});

	it("returns empty array for whitespace-only query", async () => {
		const results = await searchFTS(database, "   ");
		expect(results).toEqual([]);
	});

	it("handles special characters without throwing", async () => {
		const results = await searchFTS(database, 'auth* OR "test" AND NOT foo');
		expect(Array.isArray(results)).toBe(true);
	});

	it("respects limit parameter", async () => {
		const results = await searchFTS(database, "auth", 1);
		expect(results.length).toBeLessThanOrEqual(1);
	});
});

describe("searchGraph", () => {
	it("returns linked branches within specified depth", () => {
		const results = searchGraph(database, "domains/auth", 1);
		expect(results.length).toBeGreaterThan(0);
		const paths = results.map((r) => r.branch.relativePath);
		expect(paths).toContain("domains/sessions");
		expect(paths).toContain("domains/jwt");
	});

	it("respects depth limit", () => {
		const shallow = searchGraph(database, "ideas/graphql", 1);
		const deep = searchGraph(database, "ideas/graphql", 3);
		expect(deep.length).toBeGreaterThanOrEqual(shallow.length);
	});

	it("does not return the start node", () => {
		const results = searchGraph(database, "domains/auth");
		const paths = results.map((r) => r.branch.relativePath);
		expect(paths).not.toContain("domains/auth");
	});

	it("handles cycles without infinite loop", () => {
		const results = searchGraph(database, "domains/auth", 5);
		expect(Array.isArray(results)).toBe(true);
		const uniquePaths = new Set(results.map((r) => r.branch.relativePath));
		expect(uniquePaths.size).toBe(results.length);
	});

	it("returns empty array for nonexistent start node", () => {
		const results = searchGraph(database, "ghost/node");
		expect(results).toEqual([]);
	});

	it("assigns scores based on hop distance", () => {
		const results = searchGraph(database, "domains/auth", 2);
		const directLinks = results.filter((r) => r.score === 0.5);
		expect(directLinks.length).toBeGreaterThan(0);
	});

	it("sets mode to graph", () => {
		const results = searchGraph(database, "domains/auth");
		for (const result of results) {
			expect(result.mode).toBe("graph");
		}
	});
});

describe("searchHybrid", () => {
	it("returns merged, deduplicated, reranked results", async () => {
		const result = await searchHybrid(database, "authentication");
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.query).toBe("authentication");

		const paths = result.results.map((r) => r.branch.relativePath);
		const uniquePaths = new Set(paths);
		expect(uniquePaths.size).toBe(paths.length);
	});

	it("includes both FTS and graph counts", async () => {
		const result = await searchHybrid(database, "authentication");
		expect(result.totalFTS + result.totalGraph).toBe(result.results.length);
	});

	it("scores reflect weighted combination", async () => {
		const result = await searchHybrid(database, "authentication");
		for (const r of result.results) {
			expect(r.score).toBeGreaterThan(0);
			expect(r.score).toBeLessThanOrEqual(1);
		}
	});

	it("with ftsWeight=1 and graphWeight=0 matches pure FTS ranking", async () => {
		const ftsOnly = await searchFTS(database, "authentication");
		const hybrid = await searchHybrid(database, "authentication", {
			ftsWeight: 1,
			graphWeight: 0,
		});

		const ftsPaths = ftsOnly.map((r) => r.branch.relativePath);
		const hybridFTSPaths = hybrid.results
			.filter((r) => r.mode === "fts")
			.map((r) => r.branch.relativePath);

		for (const ftsPath of ftsPaths) {
			expect(hybridFTSPaths).toContain(ftsPath);
		}
	});

	it("returns empty results for empty query", async () => {
		const result = await searchHybrid(database, "");
		expect(result.results).toEqual([]);
		expect(result.totalFTS).toBe(0);
		expect(result.totalGraph).toBe(0);
	});

	it("handles query with no FTS matches gracefully", async () => {
		const result = await searchHybrid(database, "zzzznonexistent");
		expect(result.results).toEqual([]);
	});
});
