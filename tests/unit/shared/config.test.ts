import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	ConfigError,
	ForestNotFoundError,
	type GlobalConfig,
	NoActiveForestError,
	getGlobalConfigPath,
	getRootPath,
	loadForestConfig,
	loadGlobalConfig,
	resolveActiveTenant,
	saveForestConfig,
	saveGlobalConfig,
} from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
const originalEnv = process.env.MEMFOREST_HOME;
const originalForestEnv = process.env.MEMFOREST_FOREST;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
	process.env.MEMFOREST_HOME = tempDir;
	// biome-ignore lint/performance/noDelete: process.env requires delete to unset
	delete process.env.MEMFOREST_FOREST;
});

afterEach(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
	if (originalForestEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_FOREST;
	} else {
		process.env.MEMFOREST_FOREST = originalForestEnv;
	}
});

describe("getRootPath", () => {
	it("returns MEMFOREST_HOME when env var is set", () => {
		process.env.MEMFOREST_HOME = "/custom/path";
		expect(getRootPath()).toBe("/custom/path");
	});

	it("returns ~/.memforest when env var is not set", () => {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
		expect(getRootPath()).toBe(path.join(os.homedir(), ".memforest"));
	});

	it("returns ~/.memforest when env var is empty string", () => {
		process.env.MEMFOREST_HOME = "";
		expect(getRootPath()).toBe(path.join(os.homedir(), ".memforest"));
	});
});

describe("loadGlobalConfig", () => {
	it("returns defaults when no config file exists", () => {
		const config = loadGlobalConfig();
		expect(config.activeForest).toBeNull();
		expect(config.rootPath).toBe(tempDir);
	});

	it("creates config file with defaults on first call", () => {
		loadGlobalConfig();
		const configPath = getGlobalConfigPath();
		expect(fs.existsSync(configPath)).toBe(true);
	});

	it("throws ConfigError on malformed TOML", () => {
		const configPath = getGlobalConfigPath();
		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.writeFileSync(configPath, "invalid = = toml", "utf-8");
		expect(() => loadGlobalConfig()).toThrow(ConfigError);
	});
});

describe("saveGlobalConfig + loadGlobalConfig roundtrip", () => {
	it("preserves all fields", () => {
		const config: GlobalConfig = {
			activeForest: "my-forest",
			rootPath: tempDir,
		};
		saveGlobalConfig(config);
		const loaded = loadGlobalConfig();
		expect(loaded.activeForest).toBe("my-forest");
		expect(loaded.rootPath).toBe(tempDir);
	});

	it("handles null activeForest", () => {
		const config: GlobalConfig = {
			activeForest: null,
			rootPath: tempDir,
		};
		saveGlobalConfig(config);
		const loaded = loadGlobalConfig();
		expect(loaded.activeForest).toBeNull();
	});
});

describe("loadForestConfig", () => {
	it("throws ForestNotFoundError when path does not exist", () => {
		const nonexistent = path.join(tempDir, "forests", "ghost");
		expect(() => loadForestConfig(nonexistent)).toThrow(ForestNotFoundError);
	});

	it("loads a valid forest config", () => {
		const forestPath = path.join(tempDir, "forests", "test");
		fs.mkdirSync(forestPath, { recursive: true });
		saveForestConfig(forestPath, {
			name: "test",
			createdAt: "2026-01-01T00:00:00.000Z",
			description: "A test forest",
		});
		const config = loadForestConfig(forestPath);
		expect(config.name).toBe("test");
		expect(config.createdAt).toBe("2026-01-01T00:00:00.000Z");
		expect(config.description).toBe("A test forest");
	});
});

describe("resolveActiveTenant", () => {
	it("throws NoActiveForestError when no active forest", () => {
		loadGlobalConfig();
		expect(() => resolveActiveTenant()).toThrow(NoActiveForestError);
	});

	it("throws ForestNotFoundError when active forest directory missing", () => {
		saveGlobalConfig({ activeForest: "phantom", rootPath: tempDir });
		expect(() => resolveActiveTenant()).toThrow(ForestNotFoundError);
	});

	it("returns correct TenantContext when active forest is set", () => {
		const forestPath = path.join(tempDir, "forests", "active-forest");
		fs.mkdirSync(path.join(forestPath, "trees"), { recursive: true });
		saveForestConfig(forestPath, {
			name: "active-forest",
			createdAt: new Date().toISOString(),
			description: "",
		});
		saveGlobalConfig({ activeForest: "active-forest", rootPath: tempDir });

		const tenant = resolveActiveTenant();
		expect(tenant.name).toBe("active-forest");
		expect(tenant.forestPath).toBe(forestPath);
		expect(tenant.treesPath).toBe(path.join(forestPath, "trees"));
		expect(tenant.databasePath).toBe(path.join(forestPath, "mycelium.db"));
		expect(tenant.configPath).toBe(path.join(forestPath, "forest.toml"));
	});
});

describe("resolveActiveTenant with forest override", () => {
	function makeForest(name: string): string {
		const forestPath = path.join(tempDir, "forests", name);
		fs.mkdirSync(path.join(forestPath, "trees"), { recursive: true });
		return forestPath;
	}

	it("resolves all TenantContext paths under the override and never touches config.toml", () => {
		const forestPath = makeForest("a");

		const tenant = resolveActiveTenant("a");
		expect(tenant.name).toBe("a");
		expect(tenant.forestPath).toBe(forestPath);
		expect(tenant.treesPath).toBe(path.join(forestPath, "trees"));
		expect(tenant.databasePath).toBe(path.join(forestPath, "mycelium.db"));
		expect(tenant.configPath).toBe(path.join(forestPath, "forest.toml"));

		// The override path must skip loadGlobalConfig entirely — including its
		// write-default-config side effect on a fresh home.
		expect(fs.existsSync(getGlobalConfigPath())).toBe(false);
	});

	it("throws ForestNotFoundError for an unknown override", () => {
		expect(() => resolveActiveTenant("ghost")).toThrow(ForestNotFoundError);
	});

	it("rejects traversal-shaped overrides even when the joined path exists", () => {
		// If the regex guard were missing, path.join would resolve both of these
		// to real directories — so these assert the guard, not existsSync.
		fs.mkdirSync(path.join(tempDir, "forests", "a", "b"), { recursive: true });
		fs.mkdirSync(path.join(tempDir, "b"), { recursive: true });

		expect(() => resolveActiveTenant("a/b")).toThrow(ForestNotFoundError);
		expect(() => resolveActiveTenant("../b")).toThrow(ForestNotFoundError);
	});

	it("falls back to MEMFOREST_FOREST when no argument is given", () => {
		makeForest("a");
		process.env.MEMFOREST_FOREST = "a";

		const tenant = resolveActiveTenant();
		expect(tenant.name).toBe("a");
		expect(fs.existsSync(getGlobalConfigPath())).toBe(false);
	});

	it("prefers the explicit argument over MEMFOREST_FOREST", () => {
		makeForest("a");
		makeForest("b");
		process.env.MEMFOREST_FOREST = "a";

		const tenant = resolveActiveTenant("b");
		expect(tenant.name).toBe("b");
	});

	it("ignores an empty MEMFOREST_FOREST and uses the active forest", () => {
		const forestPath = makeForest("active-forest");
		saveForestConfig(forestPath, {
			name: "active-forest",
			createdAt: new Date().toISOString(),
			description: "",
		});
		saveGlobalConfig({ activeForest: "active-forest", rootPath: tempDir });
		process.env.MEMFOREST_FOREST = "";

		const tenant = resolveActiveTenant();
		expect(tenant.name).toBe("active-forest");
	});
});
