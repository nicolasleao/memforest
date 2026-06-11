import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as TOML from "smol-toml";
import { ConfigError, ForestNotFoundError, NoActiveForestError } from "./errors.js";
import type { ForestConfig, GlobalConfig, TenantContext } from "./types.js";

export function getRootPath(): string {
	const envHome = process.env.MEMFOREST_HOME;
	if (envHome && envHome.length > 0) {
		return envHome;
	}
	return path.join(os.homedir(), ".memforest");
}

export function getGlobalConfigPath(): string {
	return path.join(getRootPath(), "config.toml");
}

export function loadGlobalConfig(): GlobalConfig {
	const rootPath = getRootPath();
	const configPath = getGlobalConfigPath();

	if (!fs.existsSync(configPath)) {
		const defaultConfig: GlobalConfig = { activeForest: null, rootPath };
		saveGlobalConfig(defaultConfig);
		return defaultConfig;
	}

	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const parsed = TOML.parse(raw);
		return {
			activeForest: (parsed.activeForest as string) ?? null,
			rootPath,
		};
	} catch (error) {
		if (error instanceof TOML.TomlError) {
			throw new ConfigError(`Failed to parse config.toml: ${error.message}`);
		}
		throw error;
	}
}

export function saveGlobalConfig(config: GlobalConfig): void {
	const configPath = getGlobalConfigPath();
	const dir = path.dirname(configPath);
	fs.mkdirSync(dir, { recursive: true });

	const tomlData: Record<string, string> = {};
	if (config.activeForest !== null) {
		tomlData.activeForest = config.activeForest;
	}

	fs.writeFileSync(configPath, TOML.stringify(tomlData), "utf-8");
}

export function loadForestConfig(forestPath: string): ForestConfig {
	const configPath = path.join(forestPath, "forest.toml");

	if (!fs.existsSync(configPath)) {
		const forestName = path.basename(forestPath);
		throw new ForestNotFoundError(forestName);
	}

	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const parsed = TOML.parse(raw);
		return {
			name: parsed.name as string,
			createdAt: parsed.createdAt as string,
			description: (parsed.description as string) ?? "",
		};
	} catch (error) {
		if (error instanceof ForestNotFoundError) {
			throw error;
		}
		if (error instanceof TOML.TomlError) {
			throw new ConfigError(`Failed to parse forest.toml: ${error.message}`);
		}
		throw error;
	}
}

export function saveForestConfig(forestPath: string, config: ForestConfig): void {
	const configPath = path.join(forestPath, "forest.toml");
	const tomlData = {
		name: config.name,
		createdAt: config.createdAt,
		description: config.description,
	};
	fs.writeFileSync(configPath, TOML.stringify(tomlData), "utf-8");
}

// Mirrors createForest's forest-name rule (src/forest/tenant.ts) — shared cannot
// import the forest package, so the regex is duplicated here. Also blocks path
// traversal through the path.join below.
const FOREST_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export function resolveActiveTenant(forestOverride?: string): TenantContext {
	const override = forestOverride ?? process.env.MEMFOREST_FOREST;
	if (override !== undefined && override.length > 0) {
		if (!FOREST_NAME_REGEX.test(override)) {
			throw new ForestNotFoundError(override);
		}
		const forestPath = path.join(getRootPath(), "forests", override);
		if (!fs.existsSync(forestPath)) {
			throw new ForestNotFoundError(override);
		}
		return {
			name: override,
			forestPath,
			treesPath: path.join(forestPath, "trees"),
			databasePath: path.join(forestPath, "mycelium.db"),
			configPath: path.join(forestPath, "forest.toml"),
		};
	}

	const globalConfig = loadGlobalConfig();

	if (globalConfig.activeForest === null) {
		throw new NoActiveForestError();
	}

	const forestPath = path.join(globalConfig.rootPath, "forests", globalConfig.activeForest);
	if (!fs.existsSync(forestPath)) {
		throw new ForestNotFoundError(globalConfig.activeForest);
	}

	return {
		name: globalConfig.activeForest,
		forestPath,
		treesPath: path.join(forestPath, "trees"),
		databasePath: path.join(forestPath, "mycelium.db"),
		configPath: path.join(forestPath, "forest.toml"),
	};
}
