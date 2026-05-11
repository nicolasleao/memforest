import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createForest } from "@memforest/forest";
import { closeDatabase, initDatabase, openDatabase } from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
	process.env.MEMFOREST_HOME = tempDir;
	tenant = createForest("testforest", tempDir);
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

describe("initDatabase", () => {
	it("creates the database file", () => {
		const database = initDatabase(tenant);
		expect(fs.existsSync(tenant.databasePath)).toBe(true);
		closeDatabase(database);
	});

	it("creates all expected tables", () => {
		const database = initDatabase(tenant);

		const tables = database
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as { name: string }[];

		const tableNames = tables.map((t) => t.name);
		expect(tableNames).toContain("branches");
		expect(tableNames).toContain("edges");
		expect(tableNames).toContain("fts_branches");

		closeDatabase(database);
	});

	it("is idempotent — calling twice does not error", () => {
		const db1 = initDatabase(tenant);
		closeDatabase(db1);
		const db2 = initDatabase(tenant);
		closeDatabase(db2);
	});

	it("creates FTS5 triggers", () => {
		const database = initDatabase(tenant);

		const triggers = database
			.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
			.all() as { name: string }[];

		const triggerNames = triggers.map((t) => t.name);
		expect(triggerNames).toContain("branches_ai");
		expect(triggerNames).toContain("branches_ad");
		expect(triggerNames).toContain("branches_au");

		closeDatabase(database);
	});
});

describe("openDatabase", () => {
	it("opens existing database without re-running schema", () => {
		const db1 = initDatabase(tenant);
		closeDatabase(db1);
		const db2 = openDatabase(tenant);
		const tables = db2
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='branches'")
			.all();
		expect(tables).toHaveLength(1);
		closeDatabase(db2);
	});
});

describe("FTS5 triggers", () => {
	it("fires on insert — FTS row created automatically", () => {
		const database = initDatabase(tenant);

		database
			.prepare(
				`INSERT INTO branches
			 (tree_name, branch_name, relative_path, title, content, status, tags, aliases, created_at, updated_at, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				"ideas",
				"test",
				"ideas/test",
				"Test Note",
				"Some searchable content",
				"seed",
				"[]",
				"[]",
				new Date().toISOString(),
				new Date().toISOString(),
				new Date().toISOString(),
			);

		const ftsResults = database
			.prepare("SELECT * FROM fts_branches WHERE fts_branches MATCH ?")
			.all('"searchable"') as { title: string }[];

		expect(ftsResults).toHaveLength(1);

		closeDatabase(database);
	});
});

describe("closeDatabase", () => {
	it("is idempotent — calling twice does not throw", () => {
		const database = initDatabase(tenant);
		closeDatabase(database);
		closeDatabase(database);
	});
});
