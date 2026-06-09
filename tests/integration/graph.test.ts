import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createBranch, createForest } from "@memforest/forest";
import {
	closeDatabase,
	indexBranch,
	initDatabase,
	resolveEdges,
	searchGraph,
} from "@memforest/mycelium";
import type { Db } from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
let db: Db;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(async () => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-graph-"));
	process.env.MEMFOREST_HOME = tempDir;

	tenant = createForest("graph-test", tempDir);
	db = initDatabase(tenant);

	const auth = createBranch(tenant, "domains", "auth", "Authentication with [[domains/sessions]]");
	const sessions = createBranch(
		tenant,
		"domains",
		"sessions",
		"Session management with [[research/oauth]]",
	);
	const oauth = createBranch(tenant, "research", "oauth", "OAuth 2.0 protocol details");

	await indexBranch(db, tenant, auth);
	await indexBranch(db, tenant, sessions);
	await indexBranch(db, tenant, oauth);
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

describe("wiki-link graph roundtrip", () => {
	it("wiki-links become traversable graph edges", () => {
		// depth 1 from auth → sessions
		const depth1 = searchGraph(db, "domains/auth", 1);
		const depth1Paths = depth1.map((r) => r.branch.relativePath);
		expect(depth1Paths).toContain("domains/sessions");
		expect(depth1Paths).not.toContain("research/oauth");

		// depth 2 from auth → sessions + oauth
		const depth2 = searchGraph(db, "domains/auth", 2);
		const depth2Paths = depth2.map((r) => r.branch.relativePath);
		expect(depth2Paths).toContain("domains/sessions");
		expect(depth2Paths).toContain("research/oauth");

		// searchGraph is bidirectional — oauth has incoming edge from sessions
		// so depth 1 from oauth may return sessions as a neighbor
		const fromOauth = searchGraph(db, "research/oauth", 1);
		// No outbound links from oauth exist — any results come from incoming edges only
		for (const r of fromOauth) {
			expect(r.mode).toBe("graph");
		}
	});

	it("edges are stored with target_resolved=1 after resolveEdges", () => {
		const edges = db
			.prepare(
				"SELECT source_path, target_path, target_resolved FROM edges WHERE target_resolved = 1",
			)
			.all() as { source_path: string; target_path: string; target_resolved: number }[];

		const edgePairs = edges.map((e) => `${e.source_path}->${e.target_path}`);
		expect(edgePairs).toContain("domains/auth->domains/sessions");
		expect(edgePairs).toContain("domains/sessions->research/oauth");
	});
});

describe("broken links tracking", () => {
	it("broken links are tracked in edges table", async () => {
		const broken = createBranch(
			tenant,
			"ideas",
			"broken-ref",
			"Linking to [[nonexistent-branch]] here",
		);
		await indexBranch(db, tenant, broken);
		const result = await resolveEdges(db);
		expect(result.broken).toBeGreaterThan(0);

		const brokenEdges = db
			.prepare("SELECT target_path FROM edges WHERE target_resolved = 0")
			.all() as { target_path: string }[];
		const brokenTargets = brokenEdges.map((e) => e.target_path);
		expect(brokenTargets).toContain("nonexistent-branch");
	});
});
