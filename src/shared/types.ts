export interface TenantContext {
	name: string;
	forestPath: string;
	treesPath: string;
	databasePath: string;
	configPath: string;
}

export interface GlobalConfig {
	activeForest: string | null;
	rootPath: string;
}

export interface ForestConfig {
	name: string;
	createdAt: string;
	description: string;
}

export interface BranchFrontmatter {
	title: string;
	created: string;
	updated: string;
	tags: string[];
	aliases: string[];
	status: "seed" | "growing" | "mature" | "stale" | "archived";
	[key: string]: unknown;
}

export interface Branch {
	treeName: string;
	branchName: string;
	relativePath: string;
	frontmatter: BranchFrontmatter;
	content: string;
	wikiLinks: string[];
}

export interface SearchResult {
	branch: Branch;
	score: number;
	mode: "fts" | "graph";
}

export interface HybridSearchResult {
	results: SearchResult[];
	query: string;
	totalFTS: number;
	totalGraph: number;
}

export interface HealthReport {
	totalBranches: number;
	totalEdges: number;
	orphanBranches: string[];
	brokenLinks: string[];
	staleCount: number;
	indexedCount: number;
	unindexedCount: number;
}
