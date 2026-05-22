export type {
	TenantContext,
	GlobalConfig,
	ForestConfig,
	BranchFrontmatter,
	Branch,
	SearchResult,
	HybridSearchResult,
	HealthReport,
} from "./types.js";

export {
	getRootPath,
	getGlobalConfigPath,
	loadGlobalConfig,
	saveGlobalConfig,
	loadForestConfig,
	saveForestConfig,
	resolveActiveTenant,
} from "./config.js";

export {
	MemforestError,
	ForestNotFoundError,
	ForestAlreadyExistsError,
	NoActiveForestError,
	BranchNotFoundError,
	BranchAlreadyExistsError,
	ConfigError,
	DatabaseError,
	EuclidError,
	MissingApiKeyError,
} from "./errors.js";

export { createLogger } from "./logger.js";
export type { LogLevel, Logger } from "./logger.js";
