import type { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createBranch, createForest } from "@memforest/forest";
import { closeDatabase, indexBranch, initDatabase, searchFTS } from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenantA: TenantContext;
let tenantB: TenantContext;
let dbA: Database;
let dbB: Database;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(async () => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-multi-"));
	process.env.MEMFOREST_HOME = tempDir;

	tenantA = createForest("tenant-a", tempDir);
	tenantB = createForest("tenant-b", tempDir);
	dbA = initDatabase(tenantA);
	dbB = initDatabase(tenantB);

	const branchA = createBranch(
		tenantA,
		"secrets",
		"api-keys",
		"Secret API key for tenant A: sk_a_123",
	);
	await indexBranch(dbA, tenantA, branchA);

	const branchB = createBranch(
		tenantB,
		"secrets",
		"api-keys",
		"Secret API key for tenant B: sk_b_456",
	);
	await indexBranch(dbB, tenantB, branchB);
});

afterEach(() => {
	closeDatabase(dbA);
	closeDatabase(dbB);
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
});

describe("tenant isolation (CONSTITUTION 2.1, 4.1, 4.4, 4.5)", () => {
	it("tenants are fully isolated", async () => {
		const resultsA = await searchFTS(dbA, "tenant");
		expect(resultsA.length).toBe(1);
		expect(resultsA[0].branch.content).toContain("sk_a_123");

		const resultsB = await searchFTS(dbB, "tenant");
		expect(resultsB.length).toBe(1);
		expect(resultsB[0].branch.content).toContain("sk_b_456");

		// Tenant B's data must be invisible from tenant A's DB
		const crossA = await searchFTS(dbA, "sk_b_456");
		expect(crossA).toHaveLength(0);

		// Tenant A's data must be invisible from tenant B's DB
		const crossB = await searchFTS(dbB, "sk_a_123");
		expect(crossB).toHaveLength(0);
	});

	it("database files are separate", () => {
		expect(tenantA.databasePath).not.toBe(tenantB.databasePath);
		expect(fs.existsSync(tenantA.databasePath)).toBe(true);
		expect(fs.existsSync(tenantB.databasePath)).toBe(true);
	});

	it("querying tenant A DB returns only tenant A data", async () => {
		const rows = dbA.prepare("SELECT * FROM branches").all() as { content: string }[];
		expect(rows).toHaveLength(1);
		expect(rows[0].content).toContain("sk_a_123");
		expect(rows[0].content).not.toContain("sk_b_456");
	});
});
