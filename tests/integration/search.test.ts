import type { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createBranch, createForest } from "@memforest/forest";
import {
	closeDatabase,
	indexBranch,
	initDatabase,
	resolveEdges,
	searchFTS,
	searchHybrid,
} from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
let db: Database;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(async () => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-search-"));
	process.env.MEMFOREST_HOME = tempDir;

	tenant = createForest("search-test", tempDir);
	db = initDatabase(tenant);

	const branches = [
		{
			tree: "domains",
			name: "auth-patterns",
			content: "JWT tokens and session management for authentication",
		},
		{
			tree: "domains",
			name: "sessions",
			content: "Server-side sessions using Redis, session cookies",
		},
		{
			tree: "research",
			name: "oauth",
			content: "OAuth 2.0 authorization code flow with PKCE",
		},
		{
			tree: "ideas",
			name: "api-gateway",
			content: "API gateway pattern for [[domains/auth-patterns]] and rate limiting",
		},
		{
			tree: "ideas",
			name: "microservices",
			content: "Microservice architecture with [[domains/sessions]] and [[research/oauth]]",
		},
	];

	for (const b of branches) {
		const branch = createBranch(tenant, b.tree, b.name, b.content);
		await indexBranch(db, tenant, branch);
	}

	await resolveEdges(db);
});

afterEach(() => {
	closeDatabase(db);
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
});

describe("FTS accuracy", () => {
	it("returns exact keyword matches for JWT", async () => {
		const results = await searchFTS(db, "JWT");
		const paths = results.map((r) => r.branch.relativePath);
		expect(paths).toContain("domains/auth-patterns");
	});

	it("returns exact keyword matches for Redis", async () => {
		const results = await searchFTS(db, "Redis");
		const paths = results.map((r) => r.branch.relativePath);
		expect(paths).toContain("domains/sessions");
	});

	it("returns exact keyword matches for PKCE", async () => {
		const results = await searchFTS(db, "PKCE");
		const paths = results.map((r) => r.branch.relativePath);
		expect(paths).toContain("research/oauth");
	});
});

describe("hybrid search", () => {
	it("combines FTS and graph results", async () => {
		const hybrid = await searchHybrid(db, "authentication");
		expect(hybrid.results.length).toBeGreaterThan(0);

		const modes = new Set(hybrid.results.map((r) => r.mode));
		expect(modes.has("fts")).toBe(true);
	});
});
