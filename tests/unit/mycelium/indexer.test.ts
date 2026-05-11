import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createForest } from "@memforest/forest";
import {
	closeDatabase,
	indexBranch,
	initDatabase,
	reindexForest,
	removeBranchIndex,
	resolveEdges,
} from "@memforest/mycelium";
import type { Branch, TenantContext } from "@memforest/shared";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
let database: Database.Database;
const originalEnv = process.env.MEMFOREST_HOME;

function makeBranch(
	treeName: string,
	branchName: string,
	content: string,
	wikiLinks: string[] = [],
): Branch {
	return {
		treeName,
		branchName,
		relativePath: `${treeName}/${branchName}`,
		frontmatter: {
			title: branchName,
			created: "2026-01-01T00:00:00.000Z",
			updated: "2026-01-01T00:00:00.000Z",
			tags: [],
			aliases: [],
			status: "seed",
		},
		content,
		wikiLinks,
	};
}

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
	process.env.MEMFOREST_HOME = tempDir;
	tenant = createForest("testforest", tempDir);
	database = initDatabase(tenant);
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

describe("indexBranch", () => {
	it("inserts into branches, fts_branches, and edges", async () => {
		const branch = makeBranch("domains", "auth", "Authentication patterns", ["sessions"]);
		await indexBranch(database, tenant, branch);

		const row = database
			.prepare("SELECT * FROM branches WHERE relative_path = ?")
			.get("domains/auth") as { title: string; content: string } | undefined;
		expect(row).toBeDefined();
		expect(row?.title).toBe("auth");
		expect(row?.content).toBe("Authentication patterns");

		const ftsRows = database
			.prepare("SELECT * FROM fts_branches WHERE fts_branches MATCH ?")
			.all('"Authentication"');
		expect(ftsRows).toHaveLength(1);

		const edges = database
			.prepare("SELECT * FROM edges WHERE source_path = ?")
			.all("domains/auth") as { target_path: string }[];
		expect(edges).toHaveLength(1);
		expect(edges[0].target_path).toBe("sessions");
	});

	it("upserts on second call — no duplicate", async () => {
		const branch = makeBranch("domains", "auth", "V1");
		await indexBranch(database, tenant, branch);

		const updatedBranch = makeBranch("domains", "auth", "V2");
		await indexBranch(database, tenant, updatedBranch);

		const rows = database
			.prepare("SELECT * FROM branches WHERE relative_path = ?")
			.all("domains/auth");
		expect(rows).toHaveLength(1);

		const row = rows[0] as { content: string };
		expect(row.content).toBe("V2");
	});

	it("replaces edges on update", async () => {
		const branch = makeBranch("domains", "auth", "V1", ["sessions", "jwt"]);
		await indexBranch(database, tenant, branch);

		const updated = makeBranch("domains", "auth", "V2", ["tokens"]);
		await indexBranch(database, tenant, updated);

		const edges = database
			.prepare("SELECT * FROM edges WHERE source_path = ?")
			.all("domains/auth") as { target_path: string }[];
		expect(edges).toHaveLength(1);
		expect(edges[0].target_path).toBe("tokens");
	});
});

describe("removeBranchIndex", () => {
	it("removes all related data", async () => {
		const branch = makeBranch("domains", "auth", "Auth content", ["sessions"]);
		await indexBranch(database, tenant, branch);

		await removeBranchIndex(database, "domains/auth");

		const branchRow = database
			.prepare("SELECT * FROM branches WHERE relative_path = ?")
			.get("domains/auth");
		expect(branchRow).toBeUndefined();

		const edges = database
			.prepare("SELECT * FROM edges WHERE source_path = ? OR target_path = ?")
			.all("domains/auth", "domains/auth");
		expect(edges).toHaveLength(0);
	});

	it("is a no-op for non-existent branch", async () => {
		await removeBranchIndex(database, "ghost/path");
	});
});

describe("resolveEdges", () => {
	it("marks edges as resolved when target branch is indexed", async () => {
		const auth = makeBranch("domains", "auth", "Auth", ["domains/sessions"]);
		const sessions = makeBranch("domains", "sessions", "Sessions", []);
		await indexBranch(database, tenant, auth);
		await indexBranch(database, tenant, sessions);

		const result = await resolveEdges(database);
		expect(result.resolved).toBe(1);
		expect(result.broken).toBe(0);

		const edge = database
			.prepare("SELECT * FROM edges WHERE source_path = ?")
			.get("domains/auth") as { target_resolved: number };
		expect(edge.target_resolved).toBe(1);
	});

	it("leaves edges unresolved when target does not exist", async () => {
		const auth = makeBranch("domains", "auth", "Auth", ["nonexistent"]);
		await indexBranch(database, tenant, auth);

		const result = await resolveEdges(database);
		expect(result.resolved).toBe(0);
		expect(result.broken).toBe(1);
	});

	it("resolves by branch_name when target is unqualified", async () => {
		const auth = makeBranch("domains", "auth", "Auth", ["sessions"]);
		const sessions = makeBranch("domains", "sessions", "Sessions", []);
		await indexBranch(database, tenant, auth);
		await indexBranch(database, tenant, sessions);

		const result = await resolveEdges(database);
		expect(result.resolved).toBe(1);
	});
});

describe("reindexForest", () => {
	it("rebuilds from scratch", async () => {
		const auth = makeBranch("domains", "auth", "Auth content", ["sessions"]);
		await indexBranch(database, tenant, auth);

		const updatedAuth = makeBranch("domains", "auth", "Updated auth", ["tokens"]);
		const sessions = makeBranch("domains", "sessions", "Sessions", []);

		const result = await reindexForest(database, tenant, [updatedAuth, sessions]);
		expect(result.indexed).toBe(2);
		expect(result.failed).toBe(0);

		const rows = database.prepare("SELECT * FROM branches").all();
		expect(rows).toHaveLength(2);

		const edges = database.prepare("SELECT * FROM edges").all();
		expect(edges).toHaveLength(1);
	});
});
