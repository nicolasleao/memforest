import * as fs from "node:fs";
import * as path from "node:path";
import {
	ForestAlreadyExistsError,
	type ForestConfig,
	ForestNotFoundError,
	MemforestError,
	type TenantContext,
	getRootPath,
	loadGlobalConfig,
	saveForestConfig,
	saveGlobalConfig,
} from "@memforest/shared";

const FOREST_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

function buildTenantContext(name: string, rootPath: string): TenantContext {
	const forestPath = path.join(rootPath, "forests", name);
	return {
		name,
		forestPath,
		treesPath: path.join(forestPath, "trees"),
		databasePath: path.join(forestPath, "mycelium.db"),
		configPath: path.join(forestPath, "forest.toml"),
	};
}

export function createForest(name: string, rootPath?: string): TenantContext {
	if (!FOREST_NAME_REGEX.test(name)) {
		throw new MemforestError(
			`Invalid forest name "${name}". Must be 1-64 chars, alphanumeric/hyphens/underscores, starting with alphanumeric.`,
			"INVALID_FOREST_NAME",
		);
	}

	const root = rootPath ?? getRootPath();
	const tenant = buildTenantContext(name, root);

	if (fs.existsSync(tenant.forestPath)) {
		throw new ForestAlreadyExistsError(name);
	}

	fs.mkdirSync(tenant.treesPath, { recursive: true });

	const forestConfig: ForestConfig = {
		name,
		createdAt: new Date().toISOString(),
		description: "",
	};
	saveForestConfig(tenant.forestPath, forestConfig);

	return tenant;
}

export function listForests(rootPath?: string): TenantContext[] {
	const root = rootPath ?? getRootPath();
	const forestsDir = path.join(root, "forests");

	if (!fs.existsSync(forestsDir)) {
		return [];
	}

	const entries = fs.readdirSync(forestsDir, { withFileTypes: true });
	const tenants: TenantContext[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const forestToml = path.join(forestsDir, entry.name, "forest.toml");
		if (!fs.existsSync(forestToml)) {
			continue;
		}
		tenants.push(buildTenantContext(entry.name, root));
	}

	tenants.sort((a, b) => a.name.localeCompare(b.name));
	return tenants;
}

export function useForest(name: string, rootPath?: string): TenantContext {
	const root = rootPath ?? getRootPath();
	const tenant = buildTenantContext(name, root);
	const forestToml = path.join(tenant.forestPath, "forest.toml");

	if (!fs.existsSync(forestToml)) {
		throw new ForestNotFoundError(name);
	}

	const globalConfig = loadGlobalConfig();
	globalConfig.activeForest = name;
	saveGlobalConfig(globalConfig);

	return tenant;
}

export function deleteForest(name: string, rootPath?: string): void {
	const root = rootPath ?? getRootPath();
	const tenant = buildTenantContext(name, root);
	const forestToml = path.join(tenant.forestPath, "forest.toml");

	if (!fs.existsSync(forestToml)) {
		throw new ForestNotFoundError(name);
	}

	fs.rmSync(tenant.forestPath, { recursive: true, force: true });

	const globalConfig = loadGlobalConfig();
	if (globalConfig.activeForest === name) {
		globalConfig.activeForest = null;
		saveGlobalConfig(globalConfig);
	}
}

export function getForestPath(name: string, rootPath?: string): string {
	const root = rootPath ?? getRootPath();
	return path.join(root, "forests", name);
}

export function forestExists(name: string, rootPath?: string): boolean {
	const root = rootPath ?? getRootPath();
	const forestToml = path.join(root, "forests", name, "forest.toml");
	return fs.existsSync(forestToml);
}
