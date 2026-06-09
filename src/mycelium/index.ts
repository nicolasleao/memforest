export {
	ALL_SCHEMA,
	SCHEMA_BRANCHES,
	SCHEMA_EDGES,
	SCHEMA_FTS,
	SCHEMA_FTS_TRIGGERS,
} from "./schema.js";

export { openDatabase, initDatabase, closeDatabase } from "./database.js";
export type { Db } from "./database.js";

export { indexBranch, removeBranchIndex, resolveEdges, reindexForest } from "./indexer.js";

export { searchFTS, searchGraph, searchHybrid } from "./search.js";
