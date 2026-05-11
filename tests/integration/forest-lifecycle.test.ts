import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	branchExists,
	createBranch,
	createForest,
	deleteBranch,
	deleteForest,
	listForests,
	readBranch,
	updateBranch,
	useForest,
} from "@memforest/forest";
import { closeDatabase, indexBranch, initDatabase, searchFTS } from "@memforest/mycelium";
import { BranchNotFoundError, loadGlobalConfig } from "@memforest/shared";
import type { TenantContext } from "@memforest/shared";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-integ-"));
	process.env.MEMFOREST_HOME = tempDir;
});

afterEach(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
});

describe("forest lifecycle", () => {
	it("create, use, list, delete a forest", () => {
		const tenant = createForest("test-lifecycle", tempDir);
		const db = initDatabase(tenant);
		closeDatabase(db);

		expect(fs.existsSync(tenant.forestPath)).toBe(true);
		expect(fs.existsSync(tenant.treesPath)).toBe(true);
		expect(fs.existsSync(tenant.configPath)).toBe(true);

		const forests = listForests(tempDir);
		expect(forests.map((f) => f.name)).toContain("test-lifecycle");

		useForest("test-lifecycle", tempDir);
		const config = loadGlobalConfig();
		expect(config.activeForest).toBe("test-lifecycle");

		deleteForest("test-lifecycle", tempDir);
		const afterDelete = listForests(tempDir);
		expect(afterDelete.map((f) => f.name)).not.toContain("test-lifecycle");

		const configAfter = loadGlobalConfig();
		expect(configAfter.activeForest).toBeNull();
	});
});

describe("branch CRUD", () => {
	let tenant: TenantContext;
	let db: Database.Database;

	beforeEach(() => {
		tenant = createForest("branch-crud", tempDir);
		db = initDatabase(tenant);
	});

	afterEach(() => {
		closeDatabase(db);
	});

	it("create branch, read it back, update it, delete it", () => {
		const created = createBranch(tenant, "ideas", "test-idea", "Content about [[auth]]", {
			tags: ["test"],
		});
		expect(created.treeName).toBe("ideas");
		expect(created.branchName).toBe("test-idea");
		expect(created.wikiLinks).toContain("auth");
		expect(created.frontmatter.tags).toEqual(["test"]);

		const read = readBranch(tenant, "ideas", "test-idea");
		expect(read.content.trim()).toBe("Content about [[auth]]");
		expect(read.wikiLinks).toContain("auth");
		expect(read.frontmatter.tags).toEqual(["test"]);

		const updated = updateBranch(
			tenant,
			"ideas",
			"test-idea",
			"Updated content about [[sessions]]",
		);
		expect(updated.wikiLinks).toContain("sessions");
		expect(updated.wikiLinks).not.toContain("auth");
		expect(updated.frontmatter.updated).not.toBe(created.frontmatter.updated);

		const readAgain = readBranch(tenant, "ideas", "test-idea");
		expect(readAgain.content.trim()).toBe("Updated content about [[sessions]]");

		deleteBranch(tenant, "ideas", "test-idea");
		expect(branchExists(tenant, "ideas", "test-idea")).toBe(false);
		expect(() => readBranch(tenant, "ideas", "test-idea")).toThrow(BranchNotFoundError);
	});

	it("upsert + index + search roundtrip", async () => {
		const branch = createBranch(
			tenant,
			"domains",
			"auth-patterns",
			"Authentication patterns for microservices",
		);
		await indexBranch(db, tenant, branch);

		const results = await searchFTS(db, "authentication");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].branch.relativePath).toBe("domains/auth-patterns");
		expect(results[0].score).toBeGreaterThan(0);
	});
});
