import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	createForest,
	deleteForest,
	forestExists,
	getForestPath,
	listForests,
	useForest,
} from "@memforest/forest";
import {
	ForestAlreadyExistsError,
	ForestNotFoundError,
	MemforestError,
	loadGlobalConfig,
} from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
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

describe("createForest", () => {
	it("creates expected directory structure", () => {
		const tenant = createForest("myforest", tempDir);
		expect(fs.existsSync(tenant.forestPath)).toBe(true);
		expect(fs.existsSync(tenant.treesPath)).toBe(true);
		expect(fs.existsSync(tenant.configPath)).toBe(true);
		expect(tenant.name).toBe("myforest");
	});

	it("throws ForestAlreadyExistsError when created twice", () => {
		createForest("myforest", tempDir);
		expect(() => createForest("myforest", tempDir)).toThrow(ForestAlreadyExistsError);
	});

	it("throws on empty name", () => {
		expect(() => createForest("", tempDir)).toThrow(MemforestError);
	});

	it("throws on path traversal attempt", () => {
		expect(() => createForest("../../../etc", tempDir)).toThrow(MemforestError);
	});

	it("throws on name starting with hyphen", () => {
		expect(() => createForest("-invalid", tempDir)).toThrow(MemforestError);
	});

	it("throws on name starting with underscore", () => {
		expect(() => createForest("_invalid", tempDir)).toThrow(MemforestError);
	});

	it("throws on name with spaces", () => {
		expect(() => createForest("my forest", tempDir)).toThrow(MemforestError);
	});

	it("throws on name exceeding 64 characters", () => {
		const longName = "a".repeat(65);
		expect(() => createForest(longName, tempDir)).toThrow(MemforestError);
	});

	it("accepts valid names with hyphens and underscores", () => {
		const tenant = createForest("my-forest_01", tempDir);
		expect(tenant.name).toBe("my-forest_01");
	});
});

describe("listForests", () => {
	it("returns empty array when no forests exist", () => {
		const forests = listForests(tempDir);
		expect(forests).toEqual([]);
	});

	it("returns all valid forests sorted by name", () => {
		createForest("bravo", tempDir);
		createForest("alpha", tempDir);
		createForest("charlie", tempDir);
		const forests = listForests(tempDir);
		expect(forests.map((f) => f.name)).toEqual(["alpha", "bravo", "charlie"]);
	});

	it("skips directories without forest.toml", () => {
		createForest("valid", tempDir);
		fs.mkdirSync(path.join(tempDir, "forests", "invalid"), { recursive: true });
		const forests = listForests(tempDir);
		expect(forests).toHaveLength(1);
		expect(forests[0].name).toBe("valid");
	});
});

describe("useForest", () => {
	it("updates activeForest in global config", () => {
		createForest("myforest", tempDir);
		useForest("myforest", tempDir);
		const config = loadGlobalConfig();
		expect(config.activeForest).toBe("myforest");
	});

	it("throws ForestNotFoundError for nonexistent forest", () => {
		expect(() => useForest("nonexistent", tempDir)).toThrow(ForestNotFoundError);
	});
});

describe("deleteForest", () => {
	it("removes directory", () => {
		const tenant = createForest("myforest", tempDir);
		deleteForest("myforest", tempDir);
		expect(fs.existsSync(tenant.forestPath)).toBe(false);
	});

	it("clears activeForest if it was the active one", () => {
		createForest("active", tempDir);
		useForest("active", tempDir);
		expect(loadGlobalConfig().activeForest).toBe("active");
		deleteForest("active", tempDir);
		expect(loadGlobalConfig().activeForest).toBeNull();
	});

	it("throws ForestNotFoundError for nonexistent forest", () => {
		expect(() => deleteForest("ghost", tempDir)).toThrow(ForestNotFoundError);
	});

	it("does not clear activeForest if deleted forest was not active", () => {
		createForest("keep", tempDir);
		createForest("remove", tempDir);
		useForest("keep", tempDir);
		deleteForest("remove", tempDir);
		expect(loadGlobalConfig().activeForest).toBe("keep");
	});
});

describe("getForestPath", () => {
	it("returns correct path", () => {
		const result = getForestPath("myforest", tempDir);
		expect(result).toBe(path.join(tempDir, "forests", "myforest"));
	});
});

describe("forestExists", () => {
	it("returns true when forest exists", () => {
		createForest("exists", tempDir);
		expect(forestExists("exists", tempDir)).toBe(true);
	});

	it("returns false when forest does not exist", () => {
		expect(forestExists("nope", tempDir)).toBe(false);
	});
});
