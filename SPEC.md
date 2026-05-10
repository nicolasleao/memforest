# Memforest — Implementation Specification

**Version**: 1.0
**Date**: 2026-05-10
**Author**: Euclid (Spec Writer)
**Source documents**: `BRIEF.md`, `CONSTITUTION.md`, `CLAUDE.md`

This spec covers Phases 0-4. Each phase is sequential. Each step within a phase is sequential. Every step has a verification gate. Ada should be able to execute each step without asking questions.

---

## Phase 0: Foundation

**Goal**: Establish the CLI scaffold, Forest layer (multi-tenant file structure), Mycelium layer (SQLite per-tenant with FTS5, sqlite-vec, graph tables), and basic CRUD + hybrid search.

**Prerequisites**: None. This is the first phase.

**Deliverables**:
- Working CLI binary (`memforest`) with commands: `init`, `list`, `use`, `upsert`, `search`, `ask`, `health`, `reindex`
- Forest domain: tenant CRUD, markdown CRUD with frontmatter, wiki-link extraction
- Mycelium domain: SQLite schema (branches, edges, embeddings via sqlite-vec, FTS5), indexing, hybrid search
- Shared domain: types, config, errors, logger
- Integration tests covering multi-tenant isolation, search accuracy, wiki-link graph roundtrip
- All tests green via `bun run test`, all lint green via `bun run lint`, type-check green via `bun run typecheck`

---

### Step 0.1: Project Scaffold

**What**: Initialize the project with all configuration files, dependencies, directory structure, and barrel exports.

**Where**:

```
/Users/nicolas/workspace/code/personal/memforest/
  package.json
  tsconfig.json
  biome.json
  tsup.config.ts
  vitest.config.ts
  src/
    index.ts              # Main entry (re-exports nothing, just the CLI entrypoint)
    cli/
      index.ts            # Commander program definition + command wiring
    forest/
      index.ts            # Public API barrel export
    mycelium/
      index.ts            # Public API barrel export
    euclid/
      index.ts            # Public API barrel export (empty placeholder in Phase 0)
    import/
      index.ts            # Public API barrel export (empty placeholder in Phase 0)
    skill/
      index.ts            # Public API barrel export (empty placeholder in Phase 0)
    shared/
      index.ts            # Public API barrel export
  tests/
    unit/
      .gitkeep
    integration/
      .gitkeep
    fixtures/
      .gitkeep
```

**package.json**:

```json
{
  "name": "memforest",
  "version": "0.1.0",
  "description": "Multi-tenant, agent-native memory substrate",
  "type": "module",
  "bin": {
    "memforest": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^13.0.0",
    "fastembed": "^2.1.0",
    "gray-matter": "^4.0.3",
    "smol-toml": "^1.6.0",
    "sqlite-vec": "^0.1.9"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**tsconfig.json** (strict mode per CONSTITUTION 3.1):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@memforest/shared": ["src/shared/index.ts"],
      "@memforest/forest": ["src/forest/index.ts"],
      "@memforest/mycelium": ["src/mycelium/index.ts"],
      "@memforest/euclid": ["src/euclid/index.ts"],
      "@memforest/import": ["src/import/index.ts"],
      "@memforest/skill": ["src/skill/index.ts"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**biome.json** (CONSTITUTION 3.6):

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

**tsup.config.ts**:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

**vitest.config.ts**:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@memforest/shared": new URL("src/shared/index.ts", import.meta.url).pathname,
      "@memforest/forest": new URL("src/forest/index.ts", import.meta.url).pathname,
      "@memforest/mycelium": new URL("src/mycelium/index.ts", import.meta.url).pathname,
    },
  },
});
```

**Behavior**:
- Each domain `index.ts` starts as an empty barrel: `export {};` (placeholder domains get this; active domains get their exports as they're built in subsequent steps).
- `src/index.ts` imports and runs the CLI program from `src/cli/index.ts`.
- `src/cli/index.ts` creates a Commander `program` with name `memforest`, version from package.json, and description. No commands wired yet (that's Step 0.8).

**Tests**: None for this step. The verification is that the project builds and type-checks.

**Verification gate**:
```bash
cd /Users/nicolas/workspace/code/personal/memforest
bun install
bun run typecheck    # exits 0, no errors
bun run build        # produces dist/index.js
bun run lint         # exits 0
```

---

### Step 0.2: Shared Types & Config

**What**: Define all shared types, configuration loading (TOML), error hierarchy, and logger.

**Where**:
- `src/shared/types.ts` — Core type definitions
- `src/shared/config.ts` — Config loading/saving
- `src/shared/errors.ts` — Error class hierarchy
- `src/shared/logger.ts` — Structured logger
- `src/shared/index.ts` — Barrel export

**Interface** (`src/shared/types.ts`):

```typescript
export interface TenantContext {
  name: string;
  forestPath: string;       // absolute path: ~/.memforest/forests/<name>/
  treesPath: string;        // absolute path: ~/.memforest/forests/<name>/trees/
  databasePath: string;     // absolute path: ~/.memforest/forests/<name>/mycelium.db
  configPath: string;       // absolute path: ~/.memforest/forests/<name>/forest.toml
}

export interface GlobalConfig {
  activeForest: string | null;
  rootPath: string;         // default: ~/.memforest/
}

export interface ForestConfig {
  name: string;
  createdAt: string;        // ISO 8601
  description: string;
  embedding: {
    model: string;          // default: "BGESmallENV15"
    dimensions: number;     // default: 384
  };
}

export interface BranchFrontmatter {
  title: string;
  created: string;          // ISO 8601
  updated: string;          // ISO 8601
  tags: string[];
  aliases: string[];
  status: "seed" | "growing" | "mature" | "stale" | "archived";
  [key: string]: unknown;   // preserve unknown fields (CONSTITUTION 4.2)
}

export interface Branch {
  treeName: string;         // e.g. "domains", "research", "ideas"
  branchName: string;       // filename without .md extension
  relativePath: string;     // e.g. "domains/auth-patterns"
  frontmatter: BranchFrontmatter;
  content: string;          // markdown body (without frontmatter)
  wikiLinks: string[];      // extracted [[wiki-links]] targets
}

export interface SearchResult {
  branch: Branch;
  score: number;
  mode: "fts" | "semantic" | "graph";
}

export interface HybridSearchResult {
  results: SearchResult[];
  query: string;
  totalFTS: number;
  totalSemantic: number;
  totalGraph: number;
}

export interface HealthReport {
  totalBranches: number;
  totalEdges: number;
  orphanBranches: string[];     // branches with no inbound or outbound links
  brokenLinks: string[];        // wiki-links pointing to non-existent branches
  staleCount: number;           // branches with status "stale"
  indexedCount: number;         // branches in the FTS index
  unindexedCount: number;       // branches on disk but not in the index
}
```

**Interface** (`src/shared/config.ts`):

```typescript
export function getGlobalConfigPath(): string;
  // Returns: path.join(os.homedir(), ".memforest", "config.toml")

export function getRootPath(): string;
  // Returns GlobalConfig.rootPath, default: path.join(os.homedir(), ".memforest")

export function loadGlobalConfig(): GlobalConfig;
  // Reads ~/.memforest/config.toml, parses with smol-toml.
  // If file doesn't exist, returns default config: { activeForest: null, rootPath: "~/.memforest/" }
  // If file is malformed, throws ConfigError.

export function saveGlobalConfig(config: GlobalConfig): void;
  // Serializes GlobalConfig to TOML, writes to ~/.memforest/config.toml.
  // Creates directory if it doesn't exist.

export function loadForestConfig(forestPath: string): ForestConfig;
  // Reads <forestPath>/forest.toml, parses with smol-toml.
  // If file doesn't exist, throws ForestNotFoundError.

export function saveForestConfig(forestPath: string, config: ForestConfig): void;
  // Serializes ForestConfig to TOML, writes to <forestPath>/forest.toml.

export function resolveActiveTenant(): TenantContext;
  // Loads global config, reads activeForest, constructs TenantContext.
  // If activeForest is null, throws NoActiveForestError.
  // If activeForest directory doesn't exist, throws ForestNotFoundError.
```

**Interface** (`src/shared/errors.ts`):

```typescript
export class MemforestError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MemforestError";
  }
}

export class ForestNotFoundError extends MemforestError {
  constructor(name: string) {
    super(`Forest "${name}" not found`, "FOREST_NOT_FOUND");
  }
}

export class ForestAlreadyExistsError extends MemforestError {
  constructor(name: string) {
    super(`Forest "${name}" already exists`, "FOREST_ALREADY_EXISTS");
  }
}

export class NoActiveForestError extends MemforestError {
  constructor() {
    super("No active forest. Run 'memforest use <name>' first.", "NO_ACTIVE_FOREST");
  }
}

export class BranchNotFoundError extends MemforestError {
  constructor(path: string) {
    super(`Branch not found: "${path}"`, "BRANCH_NOT_FOUND");
  }
}

export class BranchAlreadyExistsError extends MemforestError {
  constructor(path: string) {
    super(`Branch already exists: "${path}"`, "BRANCH_ALREADY_EXISTS");
  }
}

export class ConfigError extends MemforestError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}

export class DatabaseError extends MemforestError {
  constructor(message: string) {
    super(message, "DATABASE_ERROR");
  }
}

export class EmbeddingError extends MemforestError {
  constructor(message: string) {
    super(message, "EMBEDDING_ERROR");
  }
}
```

**Interface** (`src/shared/logger.ts`):

```typescript
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(domain: string): Logger;
  // Returns a Logger that prefixes all messages with [domain].
  // Outputs to stderr (never stdout — stdout is reserved for CLI output).
  // Respects MEMFOREST_LOG_LEVEL env var (default: "info").
  // Format: [LEVEL] [domain] message { context }
```

**Behavior**:
- `smol-toml` is used for TOML parsing/serialization. It is a pure JS TOML parser with no native dependencies, ideal for CLI tools.
- `loadGlobalConfig()` creates the config file with defaults on first call if it does not exist. It creates `~/.memforest/` directory if missing.
- `resolveActiveTenant()` is the single point where tenant resolution happens (CONSTITUTION 2.5). All CLI commands call this once, then pass the resulting `TenantContext` downstream.
- Wiki-link extraction regex: `/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g` — captures the target from `[[target]]` and `[[target|alias]]` forms.
- All frontmatter fields except `title`, `created`, `updated`, `tags`, `aliases`, and `status` are preserved as-is in the `[key: string]: unknown` index signature. This satisfies CONSTITUTION 4.2 (unexpected fields preserved but never executed).

**Tests** (`tests/unit/shared/config.test.ts`):
- `loadGlobalConfig()` returns defaults when no config file exists
- `saveGlobalConfig()` + `loadGlobalConfig()` roundtrip preserves all fields
- `loadForestConfig()` throws `ForestNotFoundError` when path doesn't exist
- `resolveActiveTenant()` throws `NoActiveForestError` when no active forest
- `resolveActiveTenant()` returns correct `TenantContext` when active forest is set
- Use a temp directory for all config tests (not the real `~/.memforest/`)

**Tests** (`tests/unit/shared/errors.test.ts`):
- Each error class has correct `code`, `message`, and `name` properties
- All errors are instances of `MemforestError`
- All errors are instances of `Error`

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/shared/
```
Expected: all tests pass, no type errors.

---

### Step 0.3: Forest Domain -- Tenant Management

**What**: Implement forest (tenant) lifecycle operations: create, list, use, delete, get path.

**Where**:
- `src/forest/tenant.ts` — Tenant lifecycle functions
- `src/forest/index.ts` — Barrel export

**Interface** (`src/forest/tenant.ts`):

```typescript
import type { TenantContext, GlobalConfig, ForestConfig } from "@memforest/shared";

export function createForest(name: string, rootPath?: string): TenantContext;
  // 1. Validate name: alphanumeric, hyphens, underscores only. 1-64 chars. Throw MemforestError if invalid.
  // 2. Compute forest path: <rootPath>/forests/<name>/
  // 3. If directory exists, throw ForestAlreadyExistsError.
  // 4. Create directory structure:
  //    <rootPath>/forests/<name>/
  //    <rootPath>/forests/<name>/trees/
  //    <rootPath>/forests/<name>/forest.toml
  // 5. Write default ForestConfig to forest.toml (name, createdAt=now, description="", embedding defaults).
  // 6. Return constructed TenantContext.
  // Note: does NOT create mycelium.db — that's the mycelium domain's job (Step 0.5).

export function listForests(rootPath?: string): TenantContext[];
  // 1. Read <rootPath>/forests/ directory entries.
  // 2. For each subdirectory that contains a forest.toml, construct a TenantContext.
  // 3. Skip directories without forest.toml (corrupted or non-forest dirs).
  // 4. Return sorted by name.

export function useForest(name: string, rootPath?: string): TenantContext;
  // 1. Verify <rootPath>/forests/<name>/ exists with forest.toml. Throw ForestNotFoundError if not.
  // 2. Load global config, set activeForest = name, save global config.
  // 3. Return TenantContext for the forest.

export function deleteForest(name: string, rootPath?: string): void;
  // 1. Verify forest exists. Throw ForestNotFoundError if not.
  // 2. Remove entire <rootPath>/forests/<name>/ directory recursively.
  // 3. If global config's activeForest === name, set activeForest to null, save.
  // Note: The CLI layer handles confirmation prompting. This function executes unconditionally.

export function getForestPath(name: string, rootPath?: string): string;
  // Returns <rootPath>/forests/<name>/
  // Does NOT verify existence.

export function forestExists(name: string, rootPath?: string): boolean;
  // Returns true if <rootPath>/forests/<name>/forest.toml exists.
```

**Behavior**:
- `rootPath` defaults to `getRootPath()` from shared config. The parameter exists for testability (use temp dirs in tests).
- Name validation regex: `/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/`. Must start with alphanumeric. This prevents path traversal attacks (CONSTITUTION 4.2).
- `createForest` does NOT initialize the database. Per CONSTITUTION 2.2, forest domain must not touch database concerns. The CLI command will call `createForest` then `initDatabase` from mycelium.
- `listForests` silently skips invalid entries rather than throwing. A corrupted directory should not prevent listing other forests.

**Tests** (`tests/unit/forest/tenant.test.ts`):
- `createForest("myforest")` creates expected directory structure
- `createForest("myforest")` twice throws `ForestAlreadyExistsError`
- `createForest("")` throws on invalid name
- `createForest("../../../etc")` throws on path traversal attempt
- `listForests()` returns empty array when no forests exist
- `listForests()` returns all valid forests, skips dirs without forest.toml
- `useForest("myforest")` updates activeForest in global config
- `useForest("nonexistent")` throws `ForestNotFoundError`
- `deleteForest("myforest")` removes directory
- `deleteForest("active")` clears activeForest if it was the active one
- All tests use temp directories

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/forest/tenant.test.ts
```
Expected: all tests pass.

---

### Step 0.4: Forest Domain -- Markdown CRUD

**What**: Implement markdown file operations with frontmatter parsing and wiki-link extraction.

**Where**:
- `src/forest/branch.ts` — Branch CRUD operations
- `src/forest/frontmatter.ts` — Frontmatter parsing/serialization helpers
- `src/forest/wikilinks.ts` — Wiki-link extraction
- `src/forest/index.ts` — Updated barrel export

**Interface** (`src/forest/wikilinks.ts`):

```typescript
export function extractWikiLinks(content: string): string[];
  // Regex: /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  // Input: "See [[auth-patterns]] and [[domains/sessions|Sessions]]."
  // Output: ["auth-patterns", "domains/sessions"]
  // Deduplicates results.
  // Returns empty array if no wiki-links found.
```

**Interface** (`src/forest/frontmatter.ts`):

```typescript
import type { BranchFrontmatter } from "@memforest/shared";

export function parseMarkdownFile(raw: string): { frontmatter: BranchFrontmatter; content: string };
  // Uses gray-matter to split frontmatter from content.
  // Applies defaults for missing fields:
  //   title: "" (empty string)
  //   created: current ISO timestamp
  //   updated: current ISO timestamp
  //   tags: []
  //   aliases: []
  //   status: "seed"
  // Preserves all unknown frontmatter fields.

export function serializeMarkdownFile(frontmatter: BranchFrontmatter, content: string): string;
  // Uses gray-matter stringify.
  // Returns "---\n<yaml frontmatter>\n---\n<content>"
```

**Interface** (`src/forest/branch.ts`):

```typescript
import type { TenantContext, Branch, BranchFrontmatter } from "@memforest/shared";

export function createBranch(
  tenant: TenantContext,
  treeName: string,
  branchName: string,
  content: string,
  frontmatter?: Partial<BranchFrontmatter>
): Branch;
  // 1. Validate treeName and branchName: alphanumeric, hyphens, underscores, dots. No path separators.
  // 2. Compute file path: <tenant.treesPath>/<treeName>/<branchName>.md
  // 3. If file exists, throw BranchAlreadyExistsError.
  // 4. Create tree directory if it doesn't exist.
  // 5. Merge provided frontmatter with defaults (parseMarkdownFile defaults).
  //    Set title = branchName if not provided. Set created/updated = now.
  // 6. Serialize frontmatter + content, write to file.
  // 7. Extract wiki-links from content.
  // 8. Return Branch object.

export function readBranch(
  tenant: TenantContext,
  treeName: string,
  branchName: string
): Branch;
  // 1. Compute file path: <tenant.treesPath>/<treeName>/<branchName>.md
  // 2. If file doesn't exist, throw BranchNotFoundError.
  // 3. Read file, parse frontmatter + content.
  // 4. Extract wiki-links from content.
  // 5. Return Branch object.

export function updateBranch(
  tenant: TenantContext,
  treeName: string,
  branchName: string,
  content: string,
  frontmatter?: Partial<BranchFrontmatter>
): Branch;
  // 1. Read existing branch (throws BranchNotFoundError if missing).
  // 2. Merge provided frontmatter over existing frontmatter. Set updated = now.
  // 3. Serialize and write file.
  // 4. Extract wiki-links from new content.
  // 5. Return updated Branch object.

export function deleteBranch(
  tenant: TenantContext,
  treeName: string,
  branchName: string
): void;
  // 1. Compute file path.
  // 2. If file doesn't exist, throw BranchNotFoundError.
  // 3. Delete file.
  // 4. If tree directory is now empty, remove it.

export function listBranches(
  tenant: TenantContext,
  treeName?: string
): Branch[];
  // 1. If treeName provided, scan <tenant.treesPath>/<treeName>/ for .md files.
  // 2. If treeName not provided, scan all subdirectories of <tenant.treesPath>/ recursively (one level deep — trees are flat directories).
  // 3. Parse each file, construct Branch objects.
  // 4. Return sorted by relativePath.

export function branchExists(
  tenant: TenantContext,
  treeName: string,
  branchName: string
): boolean;
  // Returns true if <tenant.treesPath>/<treeName>/<branchName>.md exists.

export function resolveBranchByLink(
  tenant: TenantContext,
  linkTarget: string
): Branch | null;
  // Given a wiki-link target (e.g. "auth-patterns" or "domains/auth-patterns"):
  // 1. If target contains "/", treat as treeName/branchName. Try exact match.
  // 2. If target has no "/", search all trees for a branch with that name.
  // 3. Also check aliases in frontmatter across all branches.
  // 4. Return first match, or null if not found.
```

**Behavior**:
- Tree names and branch names are validated: `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`. This prevents path traversal (CONSTITUTION 4.2).
- Trees are single-level directories under `trees/`. No nested tree structures in v0.
- `listBranches` without a filter scans one level of subdirectories in `trees/`, then reads `.md` files in each.
- `resolveBranchByLink` is used by mycelium for graph edge resolution. It handles both qualified (`tree/branch`) and unqualified (`branch`) link targets.
- Frontmatter is always YAML (gray-matter default). Unknown fields are preserved through the `[key: string]: unknown` signature.

**Tests** (`tests/unit/forest/branch.test.ts`):
- `createBranch` writes correct file with frontmatter
- `createBranch` with partial frontmatter applies defaults
- `createBranch` throws on duplicate
- `createBranch` creates tree directory if missing
- `readBranch` returns correct Branch with parsed frontmatter and wiki-links
- `readBranch` throws BranchNotFoundError for missing branch
- `updateBranch` merges frontmatter, updates timestamp
- `updateBranch` throws for missing branch
- `deleteBranch` removes file
- `deleteBranch` removes empty tree directory
- `listBranches()` returns all branches across all trees
- `listBranches("ideas")` returns only branches in "ideas" tree
- `listBranches` returns empty array for empty forest

**Tests** (`tests/unit/forest/wikilinks.test.ts`):
- `[[simple]]` extracts `"simple"`
- `[[tree/branch]]` extracts `"tree/branch"`
- `[[target|alias]]` extracts `"target"` (not the alias)
- Multiple links in one string extracted and deduplicated
- No links returns empty array
- Nested/malformed brackets handled gracefully (no crash)

**Tests** (`tests/unit/forest/frontmatter.test.ts`):
- `parseMarkdownFile` splits frontmatter from content correctly
- Missing fields get defaults
- Unknown fields are preserved
- `serializeMarkdownFile` roundtrips with `parseMarkdownFile`

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/forest/
```
Expected: all tests pass.

---

### Step 0.5: Mycelium Domain -- Database Setup

**What**: Define the SQLite schema (branches, edges, embeddings via sqlite-vec, FTS5) and implement database initialization and connection management.

**Where**:
- `src/mycelium/database.ts` — Database connection management + initialization
- `src/mycelium/schema.ts` — Schema constants (SQL CREATE statements)
- `src/mycelium/index.ts` — Barrel export

**Schema** (`src/mycelium/schema.ts`):

```sql
-- Branches table: mirrors markdown files in the index
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tree_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'seed',
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  aliases TEXT NOT NULL DEFAULT '[]',        -- JSON array
  created_at TEXT NOT NULL,                  -- ISO 8601
  updated_at TEXT NOT NULL,                  -- ISO 8601
  indexed_at TEXT NOT NULL                   -- ISO 8601, when this row was last indexed
);

-- Edges table: wiki-link graph
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,                 -- relative_path of source branch
  target_path TEXT NOT NULL,                 -- wiki-link target (may be unresolved)
  target_resolved INTEGER NOT NULL DEFAULT 0, -- 1 if target branch exists, 0 if broken link
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_path);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_pair ON edges(source_path, target_path);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS fts_branches USING fts5(
  relative_path,
  title,
  content,
  tags,
  content=branches,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- FTS5 triggers to keep it in sync with branches table
CREATE TRIGGER IF NOT EXISTS branches_ai AFTER INSERT ON branches BEGIN
  INSERT INTO fts_branches(rowid, relative_path, title, content, tags)
  VALUES (new.id, new.relative_path, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS branches_ad AFTER DELETE ON branches BEGIN
  INSERT INTO fts_branches(fts_branches, rowid, relative_path, title, content, tags)
  VALUES ('delete', old.id, old.relative_path, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS branches_au AFTER UPDATE ON branches BEGIN
  INSERT INTO fts_branches(fts_branches, rowid, relative_path, title, content, tags)
  VALUES ('delete', old.id, old.relative_path, old.title, old.content, old.tags);
  INSERT INTO fts_branches(rowid, relative_path, title, content, tags)
  VALUES (new.id, new.relative_path, new.title, new.content, new.tags);
END;
```

The sqlite-vec virtual table is created programmatically after loading the extension:

```sql
-- Created after sqlite-vec extension is loaded
CREATE VIRTUAL TABLE IF NOT EXISTS vec_branches USING vec0(
  branch_id INTEGER PRIMARY KEY,
  embedding FLOAT[384]
);
```

The `384` dimension matches `BGESmallENV15` from fastembed (default model). If the embedding model changes, the dimension must match.

**Interface** (`src/mycelium/database.ts`):

```typescript
import type { TenantContext } from "@memforest/shared";
import Database from "better-sqlite3";

export function openDatabase(tenant: TenantContext): Database.Database;
  // 1. Open better-sqlite3 connection to tenant.databasePath.
  // 2. Enable WAL mode: db.pragma("journal_mode = WAL")
  // 3. Load sqlite-vec extension: db.loadExtension(sqliteVecPath)
  //    - sqliteVecPath obtained via: import * as sqliteVec from "sqlite-vec"; sqliteVec.getLoadablePath()
  // 4. Return the database connection.
  // Note: does NOT run schema creation. Use initDatabase for that.

export function initDatabase(tenant: TenantContext): Database.Database;
  // 1. Call openDatabase(tenant).
  // 2. Run all CREATE TABLE/TRIGGER statements from schema.ts inside a transaction.
  // 3. Create the vec_branches virtual table.
  // 4. Return the initialized database connection.

export function closeDatabase(database: Database.Database): void;
  // Closes the database connection.
  // Idempotent — safe to call on an already-closed connection.
```

**Behavior**:
- Each tenant has exactly one SQLite file at `<forestPath>/mycelium.db` (CONSTITUTION 4.5).
- WAL mode enables concurrent reads while a write is in progress — important for future daemon/watch mode.
- The sqlite-vec extension is loaded via the npm package's `getLoadablePath()` which returns the path to the compiled native extension for the current platform.
- `openDatabase` NEVER opens a database for a different tenant than the one specified. This is a constitutional invariant (CONSTITUTION 4.5: no `ATTACH DATABASE` across tenants).
- Connection management is caller-owned: the caller opens, uses, and closes the connection. No connection pool in v0 (single-process CLI).

**Tests** (`tests/unit/mycelium/database.test.ts`):
- `initDatabase` creates the database file
- `initDatabase` creates all expected tables (branches, edges, fts_branches, vec_branches)
- `initDatabase` is idempotent (calling twice doesn't error — `IF NOT EXISTS` guards)
- `openDatabase` on existing db succeeds without re-running schema
- FTS5 triggers fire correctly: insert row into branches, verify fts_branches has matching entry
- sqlite-vec extension loads successfully (vec_branches table is queryable)
- Use temp directories with createForest from Step 0.3 to set up tenant context

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/mycelium/database.test.ts
```
Expected: all tests pass. The sqlite-vec extension loads without error on the host platform.

---

### Step 0.6: Mycelium Domain -- Indexing

**What**: Implement branch indexing (FTS5 + graph edges from wiki-links + embedding generation), removal, and full reindex.

**Where**:
- `src/mycelium/indexer.ts` — Indexing operations
- `src/mycelium/embedder.ts` — Embedding generation via fastembed
- `src/mycelium/index.ts` — Updated barrel export

**Interface** (`src/mycelium/embedder.ts`):

```typescript
import { EmbeddingModel, FlagEmbedding } from "fastembed";

let embeddingInstance: FlagEmbedding | null = null;

export async function getEmbedder(): Promise<FlagEmbedding>;
  // Lazy singleton. On first call:
  //   embeddingInstance = await FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15 });
  // Returns cached instance on subsequent calls.
  // BGESmallENV15 produces 384-dimensional vectors. Fast, small model download (~45MB).
  // Model is downloaded and cached automatically by fastembed on first use
  //   (cached at <os cache dir>/fastembed_cache/).

export async function generateEmbedding(text: string): Promise<number[]>;
  // 1. Get embedder instance.
  // 2. Call embeddingInstance.queryEmbed(text) — returns number[].
  // 3. Return the embedding vector (384 floats).
  // Throws EmbeddingError on failure.

export async function generateEmbeddings(texts: string[]): Promise<number[][]>;
  // 1. Get embedder instance.
  // 2. Call embeddingInstance.embed(texts) — returns AsyncGenerator<number[][]>.
  // 3. Collect all batches, flatten to number[][].
  // 4. Return array of embedding vectors, one per input text.
  // Throws EmbeddingError on failure.
```

**Interface** (`src/mycelium/indexer.ts`):

```typescript
import type { TenantContext, Branch } from "@memforest/shared";
import type Database from "better-sqlite3";

export async function indexBranch(
  database: Database.Database,
  tenant: TenantContext,
  branch: Branch
): Promise<void>;
  // 1. Upsert into branches table:
  //    - If row with relative_path exists: UPDATE content, title, status, tags, aliases, updated_at, indexed_at.
  //    - If not: INSERT new row.
  //    The FTS5 triggers handle fts_branches sync automatically.
  // 2. Delete all existing edges WHERE source_path = branch.relativePath.
  // 3. For each wiki-link in branch.wikiLinks:
  //    a. Resolve the link target using resolveBranchByLink (from forest domain — import via shared interface).
  //       Actually: since mycelium must not import forest (CONSTITUTION 2.2), the resolution status
  //       is passed in. The caller (CLI layer or a cross-domain orchestrator) resolves links before calling.
  //       REVISED APPROACH: indexBranch receives the branch object which already has wikiLinks extracted.
  //       Insert edges with target_resolved = 0 (unresolved by default). A separate resolveEdges() call
  //       updates resolution status.
  //    b. INSERT INTO edges (source_path, target_path, target_resolved, created_at).
  //       Use INSERT OR IGNORE to handle duplicate edges gracefully.
  // 4. Generate embedding for the branch content:
  //    a. Concatenate title + " " + content as the embedding input.
  //    b. Call generateEmbedding(text).
  //    c. Get the branch's id from the branches table.
  //    d. DELETE FROM vec_branches WHERE branch_id = <id> (remove old embedding).
  //    e. INSERT INTO vec_branches (branch_id, embedding) VALUES (<id>, <vector>).

export async function removeBranchIndex(
  database: Database.Database,
  relativePath: string
): Promise<void>;
  // 1. Get branch id from branches table WHERE relative_path = relativePath.
  // 2. If not found, return (idempotent — removing a non-indexed branch is a no-op).
  // 3. DELETE FROM vec_branches WHERE branch_id = <id>.
  // 4. DELETE FROM edges WHERE source_path = relativePath.
  // 5. DELETE FROM edges WHERE target_path = relativePath.
  // 6. DELETE FROM branches WHERE id = <id>.
  //    FTS5 triggers handle fts_branches cleanup automatically.

export async function resolveEdges(
  database: Database.Database
): Promise<{ resolved: number; broken: number }>;
  // 1. SELECT DISTINCT target_path FROM edges WHERE target_resolved = 0.
  // 2. For each target_path, check if a row exists in branches WHERE relative_path = target_path.
  //    Also check if target_path (without tree prefix) matches any branch_name in branches.
  // 3. UPDATE edges SET target_resolved = 1 WHERE target_path matches a known branch.
  // 4. Return counts of newly resolved and still-broken edges.

export async function reindexForest(
  database: Database.Database,
  tenant: TenantContext,
  branches: Branch[]
): Promise<{ indexed: number; failed: number }>;
  // 1. Clear all tables: DELETE FROM vec_branches; DELETE FROM edges; DELETE FROM branches;
  //    (FTS5 triggers handle fts_branches cleanup.)
  // 2. For each branch in branches:
  //    a. Call indexBranch(database, tenant, branch).
  //    b. Track success/failure count.
  // 3. Call resolveEdges(database) to update edge resolution status.
  // 4. Return { indexed: successCount, failed: failureCount }.
  // Note: The caller (CLI) is responsible for calling listBranches() from forest domain
  //   and passing the result here. Mycelium never reads the filesystem directly.
```

**Behavior**:
- `indexBranch` is the core indexing operation. It handles both insert and update (upsert pattern on relative_path).
- The `branches` table in SQLite is a denormalized copy of the markdown file's metadata. It exists for search — the markdown file remains the source of truth (CONSTITUTION 2.4).
- Embedding is generated from `title + " " + content`. This gives the title weight in semantic search without requiring a separate title embedding.
- `reindexForest` is destructive to the index (not to markdown files). It rebuilds from scratch. The CLI warns before running.
- Edge resolution is a separate pass because mycelium cannot import forest. The edges are stored with `target_resolved = 0`, then `resolveEdges` checks the branches table (which was populated by indexing) to mark resolved edges.
- fastembed downloads the model on first use (~45MB). The spec assumes this is acceptable for a CLI tool. The model is cached globally and shared across forests.

**Tests** (`tests/unit/mycelium/indexer.test.ts`):
- `indexBranch` inserts into branches, fts_branches, edges, and vec_branches
- `indexBranch` called twice on same branch updates (upsert, not duplicate)
- `indexBranch` with wiki-links creates edges
- `removeBranchIndex` removes all related data (branches, edges, embeddings, FTS)
- `removeBranchIndex` on non-existent branch is a no-op
- `resolveEdges` marks edges as resolved when target branch is indexed
- `resolveEdges` leaves edges unresolved when target doesn't exist
- `reindexForest` rebuilds from scratch

**Tests** (`tests/unit/mycelium/embedder.test.ts`):
- `generateEmbedding` returns a 384-length number array
- `generateEmbedding` returns consistent results for the same input
- `generateEmbeddings` batch returns correct number of vectors
- These tests will download the model on first run. Mark them with a `slow` tag if needed.

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/mycelium/indexer.test.ts
bun run test -- tests/unit/mycelium/embedder.test.ts
```
Expected: all tests pass. Embedding model downloads successfully on first run.

---

### Step 0.7: Mycelium Domain -- Search

**What**: Implement FTS5 search, semantic (vector) search, graph traversal, and hybrid search with result merging and reranking.

**Where**:
- `src/mycelium/search.ts` — All search functions
- `src/mycelium/index.ts` — Updated barrel export

**Interface** (`src/mycelium/search.ts`):

```typescript
import type { TenantContext, SearchResult, HybridSearchResult, Branch } from "@memforest/shared";
import type Database from "better-sqlite3";

export async function searchFTS(
  database: Database.Database,
  query: string,
  limit?: number
): Promise<SearchResult[]>;
  // 1. Run FTS5 query:
  //    SELECT b.*, fts.rank
  //    FROM fts_branches fts
  //    JOIN branches b ON b.id = fts.rowid
  //    WHERE fts_branches MATCH ?
  //    ORDER BY fts.rank
  //    LIMIT ?
  // 2. Default limit: 20.
  // 3. Map results to SearchResult[] with mode = "fts".
  // 4. Score = normalize FTS5 rank to 0-1 range (FTS5 rank is negative; closer to 0 = better match).
  //    Normalization: score = 1 / (1 + Math.abs(rank))
  // 5. If query is empty or whitespace, return empty array.
  // 6. Handle FTS5 syntax errors gracefully: if the query contains special chars that
  //    break FTS5 syntax, escape them by wrapping each term in double quotes.

export async function searchSemantic(
  database: Database.Database,
  query: string,
  limit?: number
): Promise<SearchResult[]>;
  // 1. Generate embedding for query: queryVector = await generateEmbedding(query).
  // 2. Query sqlite-vec:
  //    SELECT branch_id, distance
  //    FROM vec_branches
  //    WHERE embedding MATCH ?
  //    ORDER BY distance
  //    LIMIT ?
  //    Pass the query vector as a JSON-serialized float array.
  // 3. For each result, load the full branch data from branches table.
  // 4. Default limit: 20.
  // 5. Map to SearchResult[] with mode = "semantic".
  // 6. Score = 1 - distance (cosine distance; 0 = identical, 1 = orthogonal).
  //    Clamp to [0, 1].

export function searchGraph(
  database: Database.Database,
  startPath: string,
  depth?: number
): SearchResult[];
  // 1. BFS from startPath through edges table.
  // 2. Default depth: 2 (direct links + one hop).
  // 3. Max depth: 5 (prevent runaway traversal).
  // 4. Collect all visited branch relative_paths.
  // 5. Load full branch data for each visited node.
  // 6. Map to SearchResult[] with mode = "graph".
  // 7. Score = 1 / (hopDistance + 1). Direct links score 0.5, two hops score 0.33, etc.
  // 8. Exclude the start node from results.
  // 9. If startPath doesn't exist in branches table, return empty array.

export async function searchHybrid(
  database: Database.Database,
  query: string,
  options?: {
    limit?: number;
    ftsWeight?: number;      // default: 0.4
    semanticWeight?: number; // default: 0.5
    graphWeight?: number;    // default: 0.1
  }
): Promise<HybridSearchResult>;
  // 1. Run searchFTS and searchSemantic in parallel (Promise.all).
  // 2. For graph search: take top FTS result's relative_path as the graph start node.
  //    If no FTS results, skip graph search.
  // 3. Merge results by relativePath:
  //    a. For each unique relativePath across all result sets:
  //       combinedScore = (ftsScore * ftsWeight) + (semanticScore * semanticWeight) + (graphScore * graphWeight)
  //       where missing scores default to 0.
  //    b. Pick the mode that contributed the highest individual score as the result's mode.
  // 4. Sort by combinedScore descending.
  // 5. Deduplicate by relativePath.
  // 6. Apply limit (default 20).
  // 7. Return HybridSearchResult with counts per mode.
```

**Behavior**:
- FTS5 search uses SQLite's built-in BM25 ranking. The `rank` column from FTS5 is negative (more negative = better match). Normalization converts to 0-1 where higher is better.
- Semantic search uses cosine distance from sqlite-vec. The `distance` column is 0 (identical) to 2 (opposite). Score = 1 - (distance / 2) normalizes to 0-1.
- Graph search is BFS, not DFS, to prioritize closer neighbors. The visited set prevents cycles.
- Hybrid search weights default to favoring semantic (0.5) over FTS (0.4) over graph (0.1). This can be tuned per query via options.
- The graph component of hybrid search uses the top FTS result as the starting node. This grounds the graph traversal in relevance rather than starting from an arbitrary node.
- Empty queries return empty results. No error thrown — it's a valid "no results" case.
- FTS5 special characters (`*`, `"`, `OR`, `AND`, `NOT`, `NEAR`) in user queries are handled by quoting each whitespace-separated term in double quotes. This prevents syntax errors from natural language queries.

**Tests** (`tests/unit/mycelium/search.test.ts`):
- Setup: create a forest, write 5+ branches with varied content and wiki-links, index them all
- `searchFTS("auth")` returns branches containing "auth" ranked by relevance
- `searchFTS("nonexistent gibberish xyz")` returns empty array
- `searchFTS("")` returns empty array
- `searchFTS` handles special characters without throwing
- `searchSemantic("authentication patterns")` returns semantically similar branches
- `searchSemantic` results are different from FTS results for the same concept expressed differently
- `searchGraph("domains/auth")` returns linked branches within specified depth
- `searchGraph` respects depth limit
- `searchGraph` does not return the start node
- `searchGraph` handles cycles without infinite loop
- `searchHybrid("auth")` returns merged, deduplicated, reranked results
- `searchHybrid` result scores reflect weighted combination
- `searchHybrid` with `{ ftsWeight: 1, semanticWeight: 0, graphWeight: 0 }` produces same ranking as pure FTS

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/mycelium/search.test.ts
```
Expected: all tests pass.

---

### Step 0.8: CLI -- Command Wiring

**What**: Wire all CLI commands using Commander.js. Each command resolves tenant context first, then dispatches to domain functions.

**Where**:
- `src/cli/index.ts` — Main program + command registration
- `src/cli/commands/init.ts` — `memforest init <name>`
- `src/cli/commands/list.ts` — `memforest list`
- `src/cli/commands/use.ts` — `memforest use <name>`
- `src/cli/commands/upsert.ts` — `memforest upsert <name> "<content>"`
- `src/cli/commands/search.ts` — `memforest search "<query>"`
- `src/cli/commands/ask.ts` — `memforest ask "<question>"`
- `src/cli/commands/health.ts` — `memforest health`
- `src/cli/commands/reindex.ts` — `memforest reindex`
- `src/index.ts` — Entry point

**Interface** (`src/cli/index.ts`):

```typescript
import { Command } from "commander";

export function createProgram(): Command;
  // Creates Commander program with:
  //   name: "memforest"
  //   description: "Multi-tenant, agent-native memory substrate"
  //   version: from package.json
  // Registers all subcommands.
  // Returns the program (does not call .parse() — that happens in src/index.ts).
```

**Interface** (`src/index.ts`):

```typescript
import { createProgram } from "./cli/index.js";

const program = createProgram();
program.parse(process.argv);
```

**Command specifications**:

**`memforest init <name>`** (`src/cli/commands/init.ts`):
```
Arguments: name (required) — forest name
Options: --description, -d <text> — optional description
Behavior:
  1. createForest(name)
  2. initDatabase(tenant)  — from mycelium domain
  3. closeDatabase(db)
  4. Print: "Forest '<name>' created at <path>"
Errors:
  - ForestAlreadyExistsError → "Forest '<name>' already exists."
  - Invalid name → "Invalid forest name. Use alphanumeric, hyphens, underscores. 1-64 chars."
Exit code: 0 on success, 1 on error.
```

**`memforest list`** (`src/cli/commands/list.ts`):
```
Arguments: none
Options: none
Behavior:
  1. listForests()
  2. loadGlobalConfig() to get activeForest
  3. Print table:
     NAME          BRANCHES    ACTIVE
     personal      42          *
     work          18
     project-x     7
  4. Branch count: open each forest's DB, SELECT COUNT(*) FROM branches.
  5. If no forests: "No forests found. Run 'memforest init <name>' to create one."
Exit code: 0.
```

**`memforest use <name>`** (`src/cli/commands/use.ts`):
```
Arguments: name (required)
Behavior:
  1. useForest(name)
  2. Print: "Active forest set to '<name>'"
Errors:
  - ForestNotFoundError → "Forest '<name>' not found. Run 'memforest list' to see available forests."
Exit code: 0 on success, 1 on error.
```

**`memforest upsert <name> "<content>"`** (`src/cli/commands/upsert.ts`):
```
Arguments:
  name (required) — branch path in format "tree/branch" (e.g. "ideas/new-concept")
  content (required) — markdown content string
Options:
  --tag, -t <tag> — repeatable, adds tags to frontmatter
  --status, -s <status> — branch status (seed|growing|mature|stale|archived)
Behavior:
  1. resolveActiveTenant()
  2. Parse name into treeName and branchName by splitting on first "/".
     If no "/" present, use "general" as default treeName.
  3. If branch exists: updateBranch + indexBranch.
  4. If branch doesn't exist: createBranch + indexBranch.
  5. Print: "Created <tree>/<branch>" or "Updated <tree>/<branch>"
  6. Close database.
Errors:
  - NoActiveForestError → printed
  - Invalid name format → "Branch name must be alphanumeric with hyphens/underscores."
Exit code: 0 on success, 1 on error.
```

**`memforest search "<query>"`** (`src/cli/commands/search.ts`):
```
Arguments: query (required)
Options:
  --mode, -m <mode> — "fts" | "semantic" | "graph" | "hybrid" (default: "hybrid")
  --limit, -l <n> — max results (default: 10)
  --json — output as JSON (agent-consumable)
Behavior:
  1. resolveActiveTenant()
  2. openDatabase(tenant)
  3. Dispatch based on mode:
     - "fts": searchFTS(db, query, limit)
     - "semantic": searchSemantic(db, query, limit)
     - "graph": searchGraph(db, query, limit)  — query is treated as startPath
     - "hybrid": searchHybrid(db, query, { limit })
  4. If --json: print JSON.stringify(results, null, 2)
  5. If not --json: print formatted table:
     SCORE  MODE      PATH                    TITLE
     0.92   semantic  domains/auth-patterns   Authentication Patterns
     0.87   fts       research/jwt-tokens     JWT Token Research
     0.45   graph     domains/sessions        Session Management
  6. If no results: "No results found for '<query>'"
  7. Close database.
Errors:
  - NoActiveForestError → printed
Exit code: 0.
```

**`memforest ask "<question>"`** (`src/cli/commands/ask.ts`):
```
Arguments: question (required)
Options:
  --json — output as JSON
Behavior:
  Phase 0 placeholder — Euclid synthesis comes in Phase 2.
  1. resolveActiveTenant()
  2. searchHybrid(db, question, { limit: 5 })
  3. Print header: "Top results for: <question>"
  4. For each result, print:
     --- <path> (score: <score>, via: <mode>) ---
     <first 200 chars of content>...
  5. Print footer: "(Full synthesis available in a future version)"
  6. If --json: output structured JSON.
  7. Close database.
Exit code: 0.
```

**`memforest health`** (`src/cli/commands/health.ts`):
```
Arguments: none
Options: --json — output as JSON
Behavior:
  1. resolveActiveTenant()
  2. listBranches(tenant) — get all branches from filesystem
  3. Open database, count indexed branches (SELECT COUNT(*) FROM branches)
  4. Compute HealthReport:
     - totalBranches: filesystem count
     - totalEdges: SELECT COUNT(*) FROM edges
     - orphanBranches: branches with no edges (neither source nor target)
     - brokenLinks: SELECT target_path FROM edges WHERE target_resolved = 0
     - staleCount: SELECT COUNT(*) FROM branches WHERE status = 'stale'
     - indexedCount: DB count
     - unindexedCount: filesystem count - DB count
  5. Print report:
     Forest Health: <name>
     Branches: 42 (3 unindexed)
     Edges: 87 (5 broken)
     Orphans: 2
     Stale: 1
  6. If --json: output HealthReport as JSON.
  7. Close database.
Exit code: 0.
```

**`memforest reindex`** (`src/cli/commands/reindex.ts`):
```
Arguments: none
Options: none
Behavior:
  1. resolveActiveTenant()
  2. listBranches(tenant)  — get all branches from filesystem
  3. openDatabase(tenant) — not initDatabase; DB already exists
  4. Print: "Reindexing <count> branches..."
  5. reindexForest(db, tenant, branches)
  6. Print: "Reindex complete. <indexed> indexed, <failed> failed."
  7. Close database.
Exit code: 0 on success, 1 if any branches failed.
```

**Behavior**:
- Every command that operates on an existing forest calls `resolveActiveTenant()` first (CONSTITUTION 2.5). The resulting `TenantContext` is passed to all downstream functions.
- Every command that opens a database closes it in a `finally` block.
- Error handling: all commands wrap their body in try/catch. Known `MemforestError` subclasses print the error message to stderr and exit 1. Unknown errors print a stack trace and exit 1.
- `--json` flag on applicable commands outputs machine-readable JSON. This is critical for agent consumption.
- stdout is for data output only. Status messages ("Creating forest...", etc.) go to stderr so they don't pollute piped output.

**Tests**: CLI commands are tested via integration tests in Step 0.9. Unit tests for individual command handler functions are optional but encouraged for complex logic (e.g., upsert's name parsing).

**Verification gate**:
```bash
bun run build
# Test the built binary
node dist/index.js --help
node dist/index.js init testforest
node dist/index.js list
node dist/index.js use testforest
node dist/index.js upsert "ideas/hello" "This is a test note about [[auth-patterns]]"
node dist/index.js search "test"
node dist/index.js health
node dist/index.js reindex
# Cleanup
rm -rf ~/.memforest/forests/testforest
```
Expected: all commands execute without error, output is readable.

---

### Step 0.9: Integration Tests

**What**: End-to-end tests covering the full stack: create forest, write branches, index, search, verify results. Multi-tenant isolation. FTS accuracy. Wiki-link graph roundtrip.

**Where**:
- `tests/integration/forest-lifecycle.test.ts`
- `tests/integration/search.test.ts`
- `tests/integration/multi-tenant.test.ts`
- `tests/integration/graph.test.ts`
- `tests/fixtures/` — Test markdown files if needed

**Test: Forest Lifecycle** (`tests/integration/forest-lifecycle.test.ts`):

```
Test: "create, use, list, delete a forest"
  1. createForest("test-lifecycle") in temp dir
  2. initDatabase(tenant)
  3. Verify directory structure exists
  4. listForests() includes "test-lifecycle"
  5. useForest("test-lifecycle")
  6. loadGlobalConfig() shows activeForest = "test-lifecycle"
  7. deleteForest("test-lifecycle")
  8. listForests() no longer includes it
  9. loadGlobalConfig() shows activeForest = null

Test: "create branch, read it back, update it, delete it"
  1. createForest + initDatabase
  2. createBranch(tenant, "ideas", "test-idea", "Content about [[auth]]", { tags: ["test"] })
  3. readBranch(tenant, "ideas", "test-idea") — verify content, frontmatter, wikiLinks
  4. updateBranch(tenant, "ideas", "test-idea", "Updated content about [[sessions]]")
  5. readBranch — verify content updated, wikiLinks changed, updated timestamp changed
  6. deleteBranch(tenant, "ideas", "test-idea")
  7. readBranch throws BranchNotFoundError

Test: "upsert + index + search roundtrip"
  1. Create forest, init DB
  2. createBranch with content "Authentication patterns for microservices"
  3. indexBranch
  4. searchFTS(db, "authentication") — returns the branch
  5. searchSemantic(db, "how to authenticate") — returns the branch
  6. Verify search results include correct relativePath and non-zero score
```

**Test: Search Accuracy** (`tests/integration/search.test.ts`):

```
Setup: create forest with 5 branches:
  - "domains/auth-patterns": "JWT tokens and session management for authentication"
  - "domains/sessions": "Server-side sessions using Redis, session cookies"
  - "research/oauth": "OAuth 2.0 authorization code flow with PKCE"
  - "ideas/api-gateway": "API gateway pattern for [[domains/auth-patterns]] and rate limiting"
  - "ideas/microservices": "Microservice architecture with [[domains/sessions]] and [[research/oauth]]"
Index all branches. Run resolveEdges.

Test: "FTS returns exact keyword matches"
  searchFTS(db, "JWT") → must include "domains/auth-patterns"
  searchFTS(db, "Redis") → must include "domains/sessions"
  searchFTS(db, "PKCE") → must include "research/oauth"

Test: "Semantic search finds conceptually related content"
  searchSemantic(db, "how to log in users") → should include auth-patterns or sessions
  searchSemantic(db, "third party login") → should include research/oauth

Test: "Hybrid combines FTS and semantic"
  searchHybrid(db, "authentication") → must return results from multiple modes
  Verify at least one result has mode "fts" and at least one has mode "semantic"
```

**Test: Multi-Tenant Isolation** (`tests/integration/multi-tenant.test.ts`):

```
Test: "tenants are fully isolated" (CONSTITUTION 2.1, 4.1, 4.4, 4.5)
  1. createForest("tenant-a"), initDatabase
  2. createForest("tenant-b"), initDatabase
  3. createBranch(tenantA, "secrets", "api-keys", "Secret API key for tenant A: sk_a_123")
  4. createBranch(tenantB, "secrets", "api-keys", "Secret API key for tenant B: sk_b_456")
  5. indexBranch both
  6. searchFTS(dbA, "tenant") → returns only tenant A's branch
  7. searchFTS(dbB, "tenant") → returns only tenant B's branch
  8. searchSemantic(dbA, "API key") → returns only tenant A's branch
  9. searchSemantic(dbB, "API key") → returns only tenant B's branch
  10. searchFTS(dbA, "sk_b_456") → returns ZERO results (tenant B's data is invisible)
  11. searchFTS(dbB, "sk_a_123") → returns ZERO results

Test: "database files are separate"
  1. Verify tenantA.databasePath !== tenantB.databasePath
  2. Verify both files exist on disk
  3. Verify opening tenantA's DB and querying branches returns only tenantA data
```

**Test: Graph Roundtrip** (`tests/integration/graph.test.ts`):

```
Test: "wiki-links become traversable graph edges"
  1. Create forest, init DB
  2. Create branches:
     - "domains/auth": content with [[domains/sessions]]
     - "domains/sessions": content with [[research/oauth]]
     - "research/oauth": content with no links
  3. Index all three, run resolveEdges
  4. searchGraph(db, "domains/auth", 1) → returns "domains/sessions"
  5. searchGraph(db, "domains/auth", 2) → returns "domains/sessions" AND "research/oauth"
  6. searchGraph(db, "research/oauth", 1) → returns empty (no outbound links)
  7. Verify edges table: edges from auth→sessions, sessions→oauth exist with target_resolved=1

Test: "broken links are tracked"
  1. Create branch with [[nonexistent-branch]] link
  2. Index it
  3. resolveEdges → broken count > 0
  4. health report shows brokenLinks includes "nonexistent-branch"
```

**Verification gate**:
```bash
bun run test
```
Expected: ALL tests pass (unit + integration). Zero failures.

```bash
bun run lint
bun run typecheck
```
Expected: zero errors.

---

## Phase 1: Import

**Goal**: Build the Obsidian import pipeline. Scan, map, resolve, embed, index, health check. Universal onboarding from any markdown folder.

**Prerequisites**: Phase 0 complete. Forest CRUD, mycelium indexing, and search all working.

**Deliverables**:
- `memforest import obsidian <path>` command
- `memforest import markdown <path>` command (generic)
- Import pipeline: scan, map, resolve, embed, index, health
- Import report with stats
- Tests covering Obsidian-specific conventions (aliases, folder structure, wiki-link variations)

---

### Step 1.1: Import Domain -- Scanner

**What**: Scan a directory for markdown files, parse each, extract metadata.

**Where**:
- `src/import/scanner.ts`
- `src/import/types.ts` — Import-specific types
- `src/import/index.ts` — Barrel export

**Interface** (`src/import/types.ts`):

```typescript
export interface ScannedFile {
  absolutePath: string;
  relativePath: string;         // relative to import root
  filename: string;             // without extension
  frontmatter: Record<string, unknown>;
  content: string;
  wikiLinks: string[];
  aliases: string[];
  tags: string[];
}

export interface ImportMapping {
  source: ScannedFile;
  targetTree: string;
  targetBranch: string;
  targetRelativePath: string;   // tree/branch
}

export interface ImportReport {
  totalScanned: number;
  totalImported: number;
  totalSkipped: number;
  totalEdges: number;
  brokenLinks: string[];
  duplicates: Array<{ original: string; renamed: string }>;
  errors: Array<{ file: string; error: string }>;
  durationMs: number;
}

export interface ImportOptions {
  flattenDirectories: boolean;  // default: false (preserve folder structure as trees)
  ignorePaths: string[];        // glob patterns to skip (default: [".obsidian/**", ".trash/**"])
  dryRun: boolean;              // default: false (if true, scan and report but don't write)
}
```

**Interface** (`src/import/scanner.ts`):

```typescript
import type { ScannedFile, ImportOptions } from "./types.js";

export async function scanDirectory(
  rootPath: string,
  options?: Partial<ImportOptions>
): Promise<ScannedFile[]>;
  // 1. Recursively find all .md files under rootPath.
  // 2. Skip paths matching ignorePaths patterns (default: .obsidian/**, .trash/**).
  // 3. For each .md file:
  //    a. Read file content.
  //    b. Parse frontmatter with gray-matter.
  //    c. Extract wiki-links using extractWikiLinks from forest domain.
  //       REVISED: Import domain has its own wiki-link extraction to avoid importing from forest.
  //       Duplicate the regex — it's two lines, not worth creating a shared dependency (CONSTITUTION 3.4).
  //    d. Extract aliases from frontmatter (Obsidian convention: aliases field, array of strings).
  //    e. Extract tags from frontmatter + inline #tags in content.
  //    f. Build ScannedFile.
  // 4. Return array of ScannedFile, sorted by relativePath.
```

**Behavior**:
- The scanner is format-agnostic. It reads any markdown folder. Obsidian-specific logic (aliases, .obsidian exclusion) is handled here as defaults, not special-cased code.
- Inline tags (`#tag-name` in content) are extracted via regex: `(?:^|\s)#([a-zA-Z0-9/_-]+)` — must be preceded by whitespace or start of line, no `#` in the middle of words.
- Files with parse errors (malformed YAML frontmatter) are collected with error messages but don't abort the scan.

**Tests** (`tests/unit/import/scanner.test.ts`):
- Scanning a directory with 3 markdown files returns 3 ScannedFiles
- `.obsidian/` directory is skipped by default
- Files with frontmatter are parsed correctly
- Files without frontmatter return empty frontmatter
- Wiki-links are extracted from content
- Aliases are extracted from Obsidian-style frontmatter
- Inline tags are extracted from content
- Malformed frontmatter produces an error entry, doesn't crash

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/import/scanner.test.ts
```

---

### Step 1.2: Import Domain -- Mapper

**What**: Map scanned files to memforest tree/branch structure. Handle directory flattening, name conflicts, and deduplication.

**Where**:
- `src/import/mapper.ts`

**Interface** (`src/import/mapper.ts`):

```typescript
import type { ScannedFile, ImportMapping, ImportOptions } from "./types.js";

export function mapToForest(
  files: ScannedFile[],
  options?: Partial<ImportOptions>
): ImportMapping[];
  // 1. For each ScannedFile:
  //    a. If flattenDirectories = false (default):
  //       - Top-level directory becomes treeName.
  //       - Filename becomes branchName.
  //       - Files at root (no parent directory) go to tree "general".
  //       - Nested directories beyond one level: join with hyphens.
  //         e.g., "research/ai/transformers.md" → tree="research", branch="ai-transformers"
  //    b. If flattenDirectories = true:
  //       - All files go to tree "imported".
  //       - branchName = filename.
  //    c. Sanitize treeName and branchName: replace spaces/special chars with hyphens,
  //       lowercase, strip leading/trailing hyphens.
  // 2. Detect name conflicts (same targetRelativePath):
  //    a. Disambiguate by appending "-N" suffix (e.g., "auth-patterns-2").
  //    b. Track renamed files for the import report.
  // 3. Return ImportMapping array.
```

**Behavior**:
- The mapper converts arbitrary folder structures into valid memforest tree/branch names.
- Name sanitization: `[^a-zA-Z0-9._-]` → `-`, collapse multiple hyphens, lowercase.
- Conflict resolution is deterministic: files are processed in sorted order, first file keeps the original name, subsequent duplicates get `-2`, `-3`, etc.

**Tests** (`tests/unit/import/mapper.test.ts`):
- Flat directory maps all files to "general" tree or "imported" tree depending on option
- Nested directories map first level to tree name
- Deep nesting (3+ levels) joins subpaths with hyphens
- Name conflicts are disambiguated with numeric suffixes
- Special characters in filenames are sanitized

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/import/mapper.test.ts
```

---

### Step 1.3: Import Domain -- Link Resolver

**What**: Resolve Obsidian wiki-link conventions to memforest branch paths. Handle aliases, folder-qualified links, and ambiguous references.

**Where**:
- `src/import/resolver.ts`

**Interface** (`src/import/resolver.ts`):

```typescript
import type { ImportMapping } from "./types.js";

export interface LinkResolution {
  originalLink: string;
  resolvedPath: string | null;  // null if unresolvable
  confidence: "exact" | "alias" | "fuzzy" | "broken";
}

export function buildLinkIndex(
  mappings: ImportMapping[]
): Map<string, string>;
  // Build a lookup map from various link forms to target relative paths:
  //   "branchName" → "tree/branch"           (unqualified link)
  //   "tree/branch" → "tree/branch"          (qualified link)
  //   "alias" → "tree/branch"                (from aliases in frontmatter)
  //   "Original Filename" → "tree/branch"    (Obsidian uses original filenames)
  // Case-insensitive keys.
  // If multiple branches match the same key, first one wins (sorted order).

export function resolveLinks(
  mappings: ImportMapping[],
  linkIndex: Map<string, string>
): Map<string, LinkResolution[]>;
  // For each mapping, resolve each wikiLink in its source:
  //   1. Try exact match in linkIndex.
  //   2. Try case-insensitive match.
  //   3. Try alias match.
  //   4. If none found, mark as broken.
  // Return Map<sourcePath, LinkResolution[]>.
```

**Behavior**:
- Obsidian wiki-links can be `[[filename]]`, `[[folder/filename]]`, or `[[filename|display text]]`. The scanner already strips the display text and extracts the target. The resolver maps those targets to memforest paths.
- The link index is case-insensitive because Obsidian is case-insensitive for link resolution on some platforms.
- Broken links are preserved in the import — they become unresolved edges in the graph (flagged in health report for Euclid to resolve later).

**Tests** (`tests/unit/import/resolver.test.ts`):
- Exact filename match resolves to correct path
- Qualified path match resolves correctly
- Alias match resolves correctly
- Case-insensitive matching works
- Unresolvable links return confidence "broken"
- `buildLinkIndex` handles duplicate filenames (first wins)

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/import/resolver.test.ts
```

---

### Step 1.4: Import Domain -- Pipeline Orchestrator

**What**: Orchestrate the full import pipeline: scan, map, resolve, write branches, embed, index, health check, report.

**Where**:
- `src/import/pipeline.ts`

**Interface** (`src/import/pipeline.ts`):

```typescript
import type { TenantContext } from "@memforest/shared";
import type { ImportOptions, ImportReport } from "./types.js";
import type Database from "better-sqlite3";

export async function runImportPipeline(
  sourcePath: string,
  tenant: TenantContext,
  database: Database.Database,
  options?: Partial<ImportOptions>
): Promise<ImportReport>;
  // 1. Validate sourcePath exists and is a directory.
  // 2. Scan: scanDirectory(sourcePath, options)
  // 3. Map: mapToForest(files, options)
  // 4. Resolve: buildLinkIndex(mappings), resolveLinks(mappings, linkIndex)
  // 5. Write: for each mapping, createBranch(tenant, tree, branch, content, frontmatter).
  //    If branch already exists (BranchAlreadyExistsError), skip and add to skipped count.
  //    Import is additive — never overwrites existing branches (CONSTITUTION 5, import domain rule).
  // 6. Index: for each successfully written branch, indexBranch(database, tenant, branch).
  //    Batch embeddings where possible — use generateEmbeddings for batches of 32.
  // 7. Resolve edges: resolveEdges(database).
  // 8. Build ImportReport with all stats.
  // 9. Return report.
  //
  // If dryRun = true: perform steps 1-4, skip 5-7, return report with projected stats.
  //
  // Progress reporting: emit log messages at each stage (via logger).
  //   "[import] Scanning <path>..."
  //   "[import] Found <n> markdown files"
  //   "[import] Mapping to forest structure..."
  //   "[import] Writing <n> branches..."
  //   "[import] Indexing <n> branches..."
  //   "[import] Resolving edges..."
  //   "[import] Import complete."
```

**Behavior**:
- The pipeline is transactional at the branch level, not at the forest level. If branch 50 of 100 fails, the first 49 are kept. Failures are logged and reported.
- Embedding generation is the bottleneck. Batch embedding (32 at a time) amortizes model inference cost.
- Import is additive only (CONSTITUTION 5, import domain: "Modify existing forest content" is forbidden). Existing branches are never overwritten.
- The pipeline creates tree directories as needed via `createBranch`.
- `dryRun` mode is valuable for previewing what an import will do before committing.

**Tests** (`tests/integration/import-pipeline.test.ts`):
- Full pipeline: create temp directory with 5 markdown files, import into new forest, verify all branches exist
- Obsidian vault structure: `.obsidian/` directory is skipped
- Wiki-links are resolved to graph edges
- Broken links are reported in ImportReport
- Duplicate filenames are disambiguated
- Dry run produces report without writing files
- Importing into a forest with existing branches doesn't overwrite
- Import report totals are accurate

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/integration/import-pipeline.test.ts
```

---

### Step 1.5: CLI -- Import Commands

**What**: Wire `memforest import obsidian <path>` and `memforest import markdown <path>` commands.

**Where**:
- `src/cli/commands/import.ts`

**Interface**:

```
memforest import obsidian <path>
  Arguments: path (required) — absolute or relative path to Obsidian vault
  Options:
    --flatten, -f — flatten directory structure into single tree
    --dry-run — preview import without writing
    --ignore <pattern> — additional glob patterns to skip (repeatable)
    --json — output report as JSON
  Behavior:
    1. resolveActiveTenant()
    2. openDatabase(tenant)
    3. runImportPipeline(path, tenant, db, { ignorePaths: [".obsidian/**", ".trash/**", ...ignore] })
    4. Print ImportReport (formatted or JSON)
    5. Close database

memforest import markdown <path>
  Same as obsidian but without .obsidian-specific ignore defaults.
  ignorePaths defaults to [] (user can add via --ignore).
```

**Behavior**:
- Both commands use the same `runImportPipeline`. The only difference is the default `ignorePaths`.
- The `obsidian` subcommand adds `.obsidian/**` and `.trash/**` to ignore. The `markdown` subcommand has no default ignores.
- Progress is printed to stderr. Report is printed to stdout.

**Verification gate**:
```bash
bun run build
# Create a test Obsidian vault
mkdir -p /tmp/test-vault/.obsidian /tmp/test-vault/domains /tmp/test-vault/ideas
echo "---\ntitle: Auth\n---\n# Auth\nSee [[sessions]]" > /tmp/test-vault/domains/auth.md
echo "---\ntitle: Sessions\n---\n# Sessions\nRelated to [[auth]]" > /tmp/test-vault/domains/sessions.md
echo "---\ntitle: Idea\naliases: [concept]\n---\n# Idea\nA new [[auth]] idea" > /tmp/test-vault/ideas/new-idea.md

node dist/index.js init import-test
node dist/index.js use import-test
node dist/index.js import obsidian /tmp/test-vault
node dist/index.js health
node dist/index.js search "auth"

# Cleanup
rm -rf ~/.memforest/forests/import-test /tmp/test-vault
```
Expected: import completes, health shows 3 branches with edges, search returns results.

---

## Phase 2: Euclid Agent

**Goal**: Wire pi-coding-agent as Euclid (the autonomous gardener). Integrate plant-idea and research-breakdown as capabilities. Implement active maintenance cycles.

**Prerequisites**: Phase 1 complete. Import pipeline working. Forest CRUD, search, and indexing all stable.

**Deliverables**:
- Euclid agent runtime using pi-coding-agent
- `memforest plant "<idea>"` command
- `memforest research "<topic>"` command
- `memforest garden` command (maintenance cycle)
- `memforest ask "<question>"` upgraded with Euclid synthesis
- Autonomy boundary enforcement
- Structured action logging

---

### Step 2.1: Euclid Domain -- Agent Runtime

**What**: Set up the Euclid agent using pi-coding-agent. Define the system prompt, tools, and runtime configuration.

**Where**:
- `src/euclid/runtime.ts` — Agent initialization and execution
- `src/euclid/prompt.ts` — System prompt construction
- `src/euclid/tools.ts` — Tool definitions for the agent
- `src/euclid/types.ts` — Euclid-specific types
- `src/euclid/index.ts` — Barrel export

**Interface** (`src/euclid/types.ts`):

```typescript
export type AutonomyLevel = "auto" | "confirm";

export interface EuclidAction {
  type: "add_link" | "update_metadata" | "flag_stale" | "plant_seed" |
        "initiate_research" | "merge_notes" | "prune_draft" | "prune_active" |
        "modify_content" | "cross_forest";
  autonomyLevel: AutonomyLevel;
  description: string;
  affectedPaths: string[];
  tenant: string;
  timestamp: string;
  rationale: string;
}

export interface EuclidConfig {
  provider: string;         // LLM provider (e.g., "anthropic", "openai")
  model: string;            // LLM model ID
  maxTokens: number;        // default: 4096
  temperature: number;      // default: 0.3 (lower for deterministic gardening)
}

export interface GardenReport {
  actions: EuclidAction[];
  linksAdded: number;
  staleFound: number;
  orphansFound: number;
  seedsPlanted: number;
  durationMs: number;
}
```

**Interface** (`src/euclid/runtime.ts`):

```typescript
import type { TenantContext } from "@memforest/shared";
import type { EuclidConfig, GardenReport } from "./types.js";
import type Database from "better-sqlite3";

export async function createEuclidAgent(
  tenant: TenantContext,
  database: Database.Database,
  config?: Partial<EuclidConfig>
): Promise<EuclidAgent>;
  // Initializes pi-coding-agent with:
  //   - System prompt from prompt.ts (includes tenant context, forest state summary)
  //   - Tools from tools.ts (search, read branch, write branch, add link, etc.)
  //   - LLM config from EuclidConfig or defaults
  // Returns an EuclidAgent handle.

export interface EuclidAgent {
  ask(question: string): Promise<string>;
    // Run Euclid in single-shot mode: question → synthesized answer with provenance.
    // Uses search tools internally, cites source branches.

  plant(ideaText: string): Promise<string[]>;
    // Plant-idea pipeline:
    //   1. Distill: extract core concepts from idea text
    //   2. Germinate: search for related existing branches
    //   3. Weave: create new branch(es) with links to related content
    // Returns array of created branch paths.

  research(topic: string): Promise<string[]>;
    // Research-breakdown pipeline:
    //   1. Search existing knowledge on topic
    //   2. Identify gaps
    //   3. Generate structured research notes
    //   4. Create branches with links
    // Returns array of created branch paths.

  garden(): Promise<GardenReport>;
    // Maintenance cycle:
    //   1. Scan forest for health issues (orphans, stale, broken links)
    //   2. Auto-fix: add obvious links, update metadata, flag stale
    //   3. Propose: generate suggestions for merges, prunes (confirm-level actions)
    //   4. Return report of all actions taken and proposed
}
```

**Interface** (`src/euclid/tools.ts`):

```typescript
// Tool definitions for pi-coding-agent.
// Each tool wraps a memforest domain function, providing it to the LLM.

export const euclidTools = [
  {
    name: "search_forest",
    description: "Search the forest using hybrid search (FTS + semantic + graph)",
    parameters: { query: "string", mode: "fts|semantic|graph|hybrid", limit: "number" },
    execute: async (params) => { /* calls searchHybrid/searchFTS/etc */ }
  },
  {
    name: "read_branch",
    description: "Read a branch's full content and metadata",
    parameters: { treeName: "string", branchName: "string" },
    execute: async (params) => { /* calls readBranch */ }
  },
  {
    name: "write_branch",
    description: "Create or update a branch",
    parameters: { treeName: "string", branchName: "string", content: "string", tags: "string[]" },
    execute: async (params) => { /* calls createBranch or updateBranch + indexBranch */ }
  },
  {
    name: "add_link",
    description: "Add a wiki-link edge between two branches",
    parameters: { sourcePath: "string", targetPath: "string" },
    execute: async (params) => { /* inserts edge, updates source branch content */ }
  },
  {
    name: "list_branches",
    description: "List all branches in the forest, optionally filtered by tree",
    parameters: { treeName: "string?" },
    execute: async (params) => { /* calls listBranches */ }
  },
  {
    name: "forest_health",
    description: "Get the forest health report",
    parameters: {},
    execute: async () => { /* computes HealthReport */ }
  }
];
```

**Behavior**:
- Euclid uses pi-coding-agent as the runtime. The agent is initialized with a system prompt that explains its role, the forest's current state, and its autonomy boundaries.
- The system prompt (from `prompt.ts`) includes: Euclid's identity, the gardener metaphor, autonomy boundary rules from CONSTITUTION section 8, the current tenant name, and a summary of forest health.
- Tool execution respects autonomy boundaries (CONSTITUTION 8.1). `write_branch` with new content (planting seeds) is auto. Modifying existing content requires confirm.
- All actions are logged as `EuclidAction` entries (CONSTITUTION 8.2).
- Euclid receives `TenantContext` at creation and operates exclusively within that tenant (CONSTITUTION 8.6).
- The LLM provider/model is configurable. Default: read from environment variables `MEMFOREST_LLM_PROVIDER` and `MEMFOREST_LLM_MODEL`, or fall back to `anthropic`/`claude-sonnet-4-20250514`.

**Tests** (`tests/unit/euclid/tools.test.ts`):
- Each tool function wraps the correct domain call
- `search_forest` returns search results
- `write_branch` creates a branch and indexes it
- `add_link` creates an edge

**Tests** (`tests/integration/euclid-agent.test.ts`):
- Note: these tests require an LLM API key. Mark as `skip` in CI if no key is available.
- `ask("what is auth?")` returns a synthesized answer referencing indexed branches
- `plant("idea about caching")` creates at least one new branch
- `garden()` returns a GardenReport with actions

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/euclid/
# Integration tests (requires LLM API key):
MEMFOREST_LLM_PROVIDER=anthropic MEMFOREST_LLM_MODEL=claude-sonnet-4-20250514 bun run test -- tests/integration/euclid-agent.test.ts
```

---

### Step 2.2: Euclid Domain -- Autonomy Enforcement

**What**: Implement the autonomy boundary system. Auto-level actions execute immediately. Confirm-level actions return proposals for user approval.

**Where**:
- `src/euclid/autonomy.ts`

**Interface** (`src/euclid/autonomy.ts`):

```typescript
import type { EuclidAction, AutonomyLevel } from "./types.js";

const AUTONOMY_MAP: Record<EuclidAction["type"], AutonomyLevel> = {
  add_link: "auto",
  update_metadata: "auto",
  flag_stale: "auto",
  plant_seed: "auto",
  initiate_research: "auto",
  merge_notes: "confirm",
  prune_draft: "auto",
  prune_active: "confirm",
  modify_content: "confirm",
  cross_forest: "confirm",
};

export function getAutonomyLevel(actionType: EuclidAction["type"]): AutonomyLevel;
  // Returns the autonomy level from AUTONOMY_MAP.
  // This map is constitutional (CONSTITUTION 8.1) — it is not configurable.

export function canAutoExecute(actionType: EuclidAction["type"]): boolean;
  // Returns true if getAutonomyLevel(actionType) === "auto".

export function validateAction(action: EuclidAction): { allowed: boolean; reason?: string };
  // 1. Check autonomy level matches expected level for action type.
  // 2. Verify tenant field is not empty.
  // 3. Verify affectedPaths are non-empty.
  // 4. Verify rationale is non-empty (CONSTITUTION 8.2).
  // 5. Return { allowed: true } or { allowed: false, reason: "..." }.
```

**Behavior**:
- The autonomy map is hardcoded, not configurable (CONSTITUTION 8.1: "Changing an action's autonomy level from Confirm to Auto requires a human-approved amendment").
- `cross_forest` is always confirm, regardless of the underlying action type (CONSTITUTION 8.3).
- Every action must have a non-empty rationale. "Euclid did something" is never acceptable (CONSTITUTION 8.2).

**Tests** (`tests/unit/euclid/autonomy.test.ts`):
- Each action type returns the correct autonomy level per BRIEF.md table
- `add_link` is auto, `merge_notes` is confirm, `prune_active` is confirm
- `cross_forest` is always confirm
- `validateAction` rejects actions with empty rationale
- `validateAction` rejects actions with empty tenant
- `validateAction` rejects actions with empty affectedPaths
- The autonomy map cannot be modified at runtime

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/euclid/autonomy.test.ts
```

---

### Step 2.3: Euclid Domain -- Action Logger

**What**: Implement structured action logging for all Euclid operations. Every action produces a log entry answering what, where, why, when (CONSTITUTION 8.2).

**Where**:
- `src/euclid/action-log.ts`

**Interface** (`src/euclid/action-log.ts`):

```typescript
import type { EuclidAction } from "./types.js";
import type Database from "better-sqlite3";

// Schema addition to mycelium.db:
// CREATE TABLE IF NOT EXISTS euclid_actions (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   type TEXT NOT NULL,
//   autonomy_level TEXT NOT NULL,
//   description TEXT NOT NULL,
//   affected_paths TEXT NOT NULL,       -- JSON array
//   tenant TEXT NOT NULL,
//   timestamp TEXT NOT NULL,            -- ISO 8601
//   rationale TEXT NOT NULL,
//   executed INTEGER NOT NULL DEFAULT 0 -- 1 if executed, 0 if proposed (pending confirm)
// );

export function initActionLog(database: Database.Database): void;
  // Creates the euclid_actions table if it doesn't exist.

export function logAction(database: Database.Database, action: EuclidAction, executed: boolean): void;
  // INSERT INTO euclid_actions.

export function getActionLog(
  database: Database.Database,
  options?: { limit?: number; type?: EuclidAction["type"]; since?: string }
): EuclidAction[];
  // SELECT from euclid_actions with optional filters.

export function getPendingActions(database: Database.Database): EuclidAction[];
  // SELECT * FROM euclid_actions WHERE executed = 0.
  // These are confirm-level actions awaiting user approval.

export function executeAction(database: Database.Database, actionId: number): void;
  // UPDATE euclid_actions SET executed = 1 WHERE id = ?.
  // Called after user approves a confirm-level action.
```

**Behavior**:
- The action log is stored in the tenant's mycelium.db. This maintains tenant isolation — each forest has its own action history.
- The `initActionLog` function is called during `initDatabase` (update Step 0.5's `initDatabase` to include this table).
- Confirm-level actions are logged with `executed = 0`. The user reviews them via `memforest garden --pending` (added in Step 2.4) and approves individually.

**Tests** (`tests/unit/euclid/action-log.test.ts`):
- `logAction` inserts a record
- `getActionLog` retrieves actions with correct filtering
- `getPendingActions` returns only un-executed confirm-level actions
- `executeAction` marks an action as executed

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/euclid/action-log.test.ts
```

---

### Step 2.4: CLI -- Euclid Commands

**What**: Wire Euclid commands: `plant`, `research`, `garden`, upgrade `ask`.

**Where**:
- `src/cli/commands/plant.ts`
- `src/cli/commands/research.ts`
- `src/cli/commands/garden.ts`
- `src/cli/commands/ask.ts` — Updated

**Command specifications**:

**`memforest plant "<idea>"`** (`src/cli/commands/plant.ts`):
```
Arguments: idea (required) — idea text
Options:
  --tree, -t <name> — target tree (default: "ideas")
  --json — output as JSON
Behavior:
  1. resolveActiveTenant()
  2. openDatabase(tenant)
  3. createEuclidAgent(tenant, db)
  4. paths = await agent.plant(idea)
  5. Print: "Planted <n> branches: <paths>"
  6. Close database
Exit code: 0 on success, 1 on error.
```

**`memforest research "<topic>"`** (`src/cli/commands/research.ts`):
```
Arguments: topic (required)
Options:
  --depth <n> — research depth (1=surface, 3=deep). Default: 2
  --json — output as JSON
Behavior:
  1. resolveActiveTenant()
  2. openDatabase(tenant)
  3. createEuclidAgent(tenant, db)
  4. paths = await agent.research(topic)
  5. Print: "Research complete. Created <n> branches: <paths>"
  6. Close database
Exit code: 0.
```

**`memforest garden`** (`src/cli/commands/garden.ts`):
```
Arguments: none
Options:
  --pending — show pending confirm-level actions
  --approve <id> — approve a pending action by ID
  --approve-all — approve all pending actions
  --json — output as JSON
Behavior:
  Without flags:
    1. resolveActiveTenant()
    2. openDatabase, createEuclidAgent
    3. report = await agent.garden()
    4. Print GardenReport:
       Garden Report for <name>:
       Links added: 5
       Stale flagged: 2
       Orphans found: 3
       Seeds planted: 1
       Pending proposals: 2 (run 'memforest garden --pending' to review)
    5. Close database

  With --pending:
    1. resolveActiveTenant(), openDatabase
    2. getPendingActions(db)
    3. Print each pending action with ID, type, description, rationale

  With --approve <id>:
    1. Load action by ID, verify it's pending
    2. Execute the action (call the appropriate domain function)
    3. Mark as executed in action log
    4. Print: "Action <id> approved and executed."

  With --approve-all:
    1. Load all pending actions
    2. Execute each, mark as executed
    3. Print summary
```

**`memforest ask "<question>"` — UPGRADED** (`src/cli/commands/ask.ts`):
```
Arguments: question (required)
Options:
  --json — output as JSON
  --raw — skip Euclid synthesis, return raw search results (Phase 0 behavior)
Behavior:
  Without --raw:
    1. resolveActiveTenant()
    2. openDatabase, createEuclidAgent
    3. answer = await agent.ask(question)
    4. Print synthesized answer with source citations
    5. Close database

  With --raw:
    Phase 0 behavior (search + raw results)
```

**Verification gate**:
```bash
bun run build
# Requires LLM API key
export MEMFOREST_LLM_PROVIDER=anthropic
export MEMFOREST_LLM_MODEL=claude-sonnet-4-20250514
node dist/index.js init euclid-test
node dist/index.js use euclid-test
node dist/index.js upsert "domains/auth" "Authentication patterns using JWT and sessions"
node dist/index.js upsert "domains/sessions" "Server-side session management with Redis"
node dist/index.js plant "What if we combined JWT with session tokens for hybrid auth?"
node dist/index.js ask "How does authentication work in our system?"
node dist/index.js garden
node dist/index.js garden --pending
# Cleanup
rm -rf ~/.memforest/forests/euclid-test
```

---

## Phase 3: Integration

**Goal**: Generate SKILL.md files for agent harnesses. Make memforest installable into Claude Code, OpenCode, and Pi with a single command.

**Prerequisites**: Phase 2 complete. Euclid agent functional. CLI commands stable.

**Deliverables**:
- `memforest install claude-code` command
- `memforest install opencode` command
- `memforest install pi` command
- `memforest install --format skill.md` command (generic)
- Generated SKILL.md files that instruct agents to use memforest commands

---

### Step 3.1: Skill Domain -- Template Engine

**What**: Build the SKILL.md template system. Define templates for each agent harness format.

**Where**:
- `src/skill/templates.ts` — Template strings for each harness
- `src/skill/types.ts` — Skill-specific types
- `src/skill/index.ts` — Barrel export

**Interface** (`src/skill/types.ts`):

```typescript
export type HarnessType = "claude-code" | "opencode" | "pi" | "generic";

export interface SkillTemplate {
  harness: HarnessType;
  outputPath: string;           // where to write the file
  content: string;              // generated SKILL.md content
}

export interface SkillContext {
  forestName: string;
  availableCommands: string[];  // list of CLI commands
  version: string;              // memforest version
}
```

**Interface** (`src/skill/templates.ts`):

```typescript
import type { HarnessType, SkillTemplate, SkillContext } from "./types.js";

export function generateSkill(
  harness: HarnessType,
  context: SkillContext,
  targetDir: string
): SkillTemplate;
  // Generates the appropriate SKILL.md content for the harness.
  //
  // Claude Code:
  //   outputPath: <targetDir>/.claude/skills/memforest.md
  //   Content instructs the agent to:
  //     - Use `memforest ask "<question>"` for knowledge retrieval
  //     - Use `memforest search "<query>" --json` for structured results
  //     - Use `memforest upsert` to save new knowledge
  //     - Never read/write forest files directly
  //     - Cite sources from search results
  //
  // OpenCode:
  //   outputPath: <targetDir>/.opencode/skills/memforest.md
  //   Same content structure, adapted for OpenCode conventions
  //
  // Pi:
  //   outputPath: <targetDir>/SKILL.md
  //   Pi-coding-agent SKILL.md format
  //
  // Generic:
  //   outputPath: stdout (no file written)
  //   Format-agnostic skill description

export function getOutputPath(harness: HarnessType, targetDir: string): string;
  // Returns the expected output file path for the given harness type.
```

**Behavior**:
- The SKILL.md teaches agents to interact with the forest through CLI commands, not through file paths. This is the core value proposition: agents interact with Euclid, not with raw files.
- Templates include: command reference, usage examples, when to search vs. ask, when to upsert.
- Templates are statically defined strings with interpolation for forest name, version, and command list. No templating engine dependency.

**Tests** (`tests/unit/skill/templates.test.ts`):
- `generateSkill("claude-code", ...)` produces valid markdown with correct output path
- `generateSkill("opencode", ...)` produces valid markdown with correct output path
- `generateSkill("pi", ...)` produces valid markdown with SKILL.md path
- `generateSkill("generic", ...)` produces valid markdown
- All generated skills reference `memforest ask`, `memforest search`, `memforest upsert`
- Output paths are correct for each harness type

**Verification gate**:
```bash
bun run typecheck
bun run test -- tests/unit/skill/templates.test.ts
```

---

### Step 3.2: CLI -- Install Commands

**What**: Wire `memforest install <harness>` command.

**Where**:
- `src/cli/commands/install.ts`

**Interface**:

```
memforest install <harness>
  Arguments: harness (required) — "claude-code" | "opencode" | "pi"
  Options:
    --dir, -d <path> — target directory (default: current working directory)
    --format <format> — output format for generic skill (default: "skill.md")
    --stdout — print to stdout instead of writing file
  Behavior:
    1. resolveActiveTenant() — get active forest name for skill context
    2. Determine target directory (--dir or cwd)
    3. generateSkill(harness, context, targetDir)
    4. If --stdout: print content to stdout
    5. Else: write file to outputPath, creating directories as needed
    6. Print: "Installed memforest skill at <path>"
  Errors:
    - Unknown harness → list valid options
    - Write permission error → "Cannot write to <path>. Check permissions."
```

**Verification gate**:
```bash
bun run build
mkdir -p /tmp/skill-test
node dist/index.js init skill-test-forest
node dist/index.js use skill-test-forest

node dist/index.js install claude-code --dir /tmp/skill-test
cat /tmp/skill-test/.claude/skills/memforest.md  # verify content

node dist/index.js install opencode --dir /tmp/skill-test
cat /tmp/skill-test/.opencode/skills/memforest.md

node dist/index.js install pi --dir /tmp/skill-test
cat /tmp/skill-test/SKILL.md

node dist/index.js install pi --stdout  # prints to stdout

# Cleanup
rm -rf /tmp/skill-test ~/.memforest/forests/skill-test-forest
```
Expected: all skill files are written with correct content referencing memforest commands.

---

## Phase 4: TUI

**Goal**: Build an interactive terminal UI using pi-tui. Chat with Euclid. Visual graph exploration. Garden sessions.

**Prerequisites**: Phase 3 complete. All CLI commands stable. Euclid agent functional.

**Deliverables**:
- `memforest` (no args) opens TUI
- `memforest tui` explicitly opens TUI
- Chat interface with Euclid
- Forest browser (tree/branch navigation)
- Graph visualization (ASCII graph of connections)
- Garden session (interactive maintenance)

---

### Step 4.1: TUI -- Application Shell

**What**: Set up the pi-tui application with navigation, panels, and keyboard shortcuts.

**Where**:
- `src/cli/tui/app.ts` — Main TUI application
- `src/cli/tui/types.ts` — TUI-specific types
- `src/cli/tui/index.ts` — Barrel export

**Interface** (`src/cli/tui/types.ts`):

```typescript
export type TUIView = "chat" | "browse" | "graph" | "garden" | "health";

export interface TUIState {
  activeView: TUIView;
  tenant: TenantContext;
  chatHistory: Array<{ role: "user" | "euclid"; content: string }>;
  selectedBranch: string | null;
  graphRoot: string | null;
  graphDepth: number;
}
```

**Interface** (`src/cli/tui/app.ts`):

```typescript
import type { TenantContext } from "@memforest/shared";

export async function launchTUI(tenant: TenantContext): Promise<void>;
  // 1. Initialize pi-tui application.
  // 2. Set up panels:
  //    - Header: "memforest v<version> | Forest: <name> | View: <activeView>"
  //    - Sidebar: view switcher (chat/browse/graph/garden/health)
  //    - Main: active view content
  //    - Footer: keybindings help
  // 3. Keyboard shortcuts:
  //    - Ctrl+C / q: quit
  //    - Tab: cycle views
  //    - 1-5: jump to specific view
  //    - /: focus search input
  //    - Enter: send chat message / select item
  // 4. Start event loop.
```

**Behavior**:
- The TUI is a pi-tui application. pi-tui handles rendering, input, and layout.
- The TUI resolves tenant context once at launch (same as CLI commands).
- State is managed locally in the TUI process. No persistence beyond the session (chat history is ephemeral).

**Tests**: TUI tests are primarily manual. Automated tests focus on the state management logic, not rendering.

**Tests** (`tests/unit/tui/state.test.ts`):
- View switching updates activeView
- Chat history appends messages correctly
- Branch selection updates selectedBranch

**Verification gate**:
```bash
bun run build
node dist/index.js init tui-test
node dist/index.js use tui-test
node dist/index.js tui  # launches TUI, verify it renders without crashing
# Ctrl+C to exit
rm -rf ~/.memforest/forests/tui-test
```

---

### Step 4.2: TUI -- Chat View

**What**: Implement the chat interface. Users type questions, Euclid responds with synthesized answers.

**Where**:
- `src/cli/tui/views/chat.ts`

**Interface** (`src/cli/tui/views/chat.ts`):

```typescript
import type { TUIState } from "../types.js";
import type { EuclidAgent } from "@memforest/euclid";

export interface ChatView {
  render(state: TUIState): void;
    // Renders:
    //   - Chat history (scrollable, newest at bottom)
    //   - Input field at bottom
    //   - "Euclid is thinking..." indicator while waiting for response

  handleInput(input: string, agent: EuclidAgent, state: TUIState): Promise<TUIState>;
    // 1. Append { role: "user", content: input } to chatHistory.
    // 2. Call agent.ask(input).
    // 3. Append { role: "euclid", content: response } to chatHistory.
    // 4. Return updated state.
}
```

**Behavior**:
- Chat messages are rendered with visual distinction between user and Euclid (different colors/prefixes).
- Euclid's responses include source citations (branch paths) from search results.
- While Euclid is processing, a spinner or "thinking..." indicator is shown.
- Chat history is scrollable. Long responses are word-wrapped.

**Verification gate**: Manual testing. Launch TUI, switch to chat view, send a question, verify response appears.

---

### Step 4.3: TUI -- Browse View

**What**: Implement the forest browser. Navigate trees and branches, view content.

**Where**:
- `src/cli/tui/views/browse.ts`

**Interface** (`src/cli/tui/views/browse.ts`):

```typescript
export interface BrowseView {
  render(state: TUIState): void;
    // Renders:
    //   - Left panel: tree list (expandable to show branches)
    //   - Right panel: selected branch content (rendered markdown)
    //   - Status bar: branch metadata (status, tags, created, updated)

  handleNavigation(key: string, state: TUIState): TUIState;
    // Arrow keys: navigate tree/branch list
    // Enter: expand tree / select branch
    // Backspace: collapse / go up
}
```

**Behavior**:
- Trees are listed alphabetically. Expanding a tree shows its branches.
- Selecting a branch shows its content in the right panel with frontmatter metadata in the status bar.
- Content panel renders markdown with basic formatting (headers, bold, links highlighted).

**Verification gate**: Manual testing. Launch TUI, create some branches first, switch to browse view, navigate trees and branches.

---

### Step 4.4: TUI -- Graph View

**What**: Implement ASCII graph visualization. Show the local neighborhood of a selected branch.

**Where**:
- `src/cli/tui/views/graph.ts`

**Interface** (`src/cli/tui/views/graph.ts`):

```typescript
export interface GraphView {
  render(state: TUIState): void;
    // Renders:
    //   - ASCII graph centered on graphRoot node
    //   - Nodes are branch names
    //   - Edges are lines/arrows between nodes
    //   - Current node highlighted
    //   - Depth control (1-5 hops)

  handleNavigation(key: string, state: TUIState): TUIState;
    // Arrow keys: navigate between nodes
    // Enter: recenter graph on selected node
    // +/-: increase/decrease graph depth
    // /: search for a node to center on
}
```

**Behavior**:
- Graph is rendered as ASCII art. Nodes are boxes with branch names, edges are lines.
- Layout algorithm: simple force-directed or tree layout. Root in center, connected nodes around it.
- Depth is adjustable from 1 to 5. Default: 2.
- Selecting a node and pressing Enter recenters the graph on that node.
- If graph is too large for the terminal, the view is scrollable.

**Verification gate**: Manual testing. Create branches with wiki-links, launch TUI, switch to graph view, navigate the graph.

---

### Step 4.5: TUI -- Garden View

**What**: Interactive gardening session. Run maintenance, review proposals, approve/reject actions.

**Where**:
- `src/cli/tui/views/garden.ts`

**Interface** (`src/cli/tui/views/garden.ts`):

```typescript
export interface GardenView {
  render(state: TUIState): void;
    // Renders:
    //   - Health summary at top
    //   - Action log (recent auto-executed actions)
    //   - Pending proposals (confirm-level actions awaiting approval)
    //   - "Run garden cycle" button

  handleAction(key: string, agent: EuclidAgent, state: TUIState): Promise<TUIState>;
    // g: trigger garden cycle
    // Enter on pending action: show detail + approve/reject dialog
    // y: approve selected pending action
    // n: reject selected pending action
    // r: refresh health data
}
```

**Behavior**:
- The garden view is a dashboard. Top section shows HealthReport metrics. Middle shows the action log. Bottom shows pending proposals.
- Running a garden cycle calls `agent.garden()` and updates the display with the report.
- Pending actions show type, description, affected paths, and rationale. The user can approve or reject each one.
- Approved actions are executed immediately and logged. Rejected actions are removed from pending.

**Verification gate**: Manual testing. Create a forest with branches, launch TUI, switch to garden view, run a garden cycle, review and approve/reject proposals.

---

### Step 4.6: CLI -- TUI Entry Points

**What**: Wire `memforest` (no args) and `memforest tui` to launch the TUI.

**Where**:
- `src/cli/index.ts` — Updated
- `src/cli/commands/tui.ts`

**Interface**:

```
memforest (no arguments):
  If stdin is a TTY → launch TUI
  If stdin is not a TTY → print help (non-interactive context)

memforest tui:
  Always launch TUI.
  Options:
    --view, -v <view> — start on specific view (chat|browse|graph|garden|health)
  Behavior:
    1. resolveActiveTenant()
    2. launchTUI(tenant)
  Errors:
    - NoActiveForestError → "No active forest. Run 'memforest use <name>' first."
    - Not a TTY → "TUI requires an interactive terminal."
```

**Verification gate**:
```bash
bun run build
node dist/index.js init tui-final-test
node dist/index.js use tui-final-test
node dist/index.js upsert "ideas/test" "A test idea for the TUI [[ideas/another]]"
node dist/index.js upsert "ideas/another" "Another idea linked from test"
node dist/index.js tui                    # launches TUI
node dist/index.js tui --view graph       # launches TUI in graph view
# Ctrl+C to exit
rm -rf ~/.memforest/forests/tui-final-test
```
Expected: TUI launches, all views render, navigation works, chat produces Euclid responses.

---

## Appendix A: Dependency Graph

```
Phase 0
  Step 0.1: Project Scaffold
    └─ Step 0.2: Shared Types & Config
        ├─ Step 0.3: Forest — Tenant Management
        │   └─ Step 0.4: Forest — Markdown CRUD
        │       └─ Step 0.5: Mycelium — Database Setup
        │           └─ Step 0.6: Mycelium — Indexing
        │               └─ Step 0.7: Mycelium — Search
        │                   └─ Step 0.8: CLI — Command Wiring
        │                       └─ Step 0.9: Integration Tests

Phase 1 (depends on Phase 0)
  Step 1.1: Scanner
    └─ Step 1.2: Mapper
        └─ Step 1.3: Link Resolver
            └─ Step 1.4: Pipeline Orchestrator
                └─ Step 1.5: CLI Import Commands

Phase 2 (depends on Phase 1)
  Step 2.1: Agent Runtime
    └─ Step 2.2: Autonomy Enforcement
        └─ Step 2.3: Action Logger
            └─ Step 2.4: CLI Euclid Commands

Phase 3 (depends on Phase 2)
  Step 3.1: Template Engine
    └─ Step 3.2: CLI Install Commands

Phase 4 (depends on Phase 3)
  Step 4.1: TUI App Shell
    ├─ Step 4.2: Chat View
    ├─ Step 4.3: Browse View
    ├─ Step 4.4: Graph View
    └─ Step 4.5: Garden View
        └─ Step 4.6: CLI TUI Entry Points
```

## Appendix B: Package Reference

| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | ^11.0.0 | SQLite driver for Node.js |
| `sqlite-vec` | ^0.1.9 | Vector search extension for SQLite |
| `fastembed` | ^2.1.0 | Local embedding generation (ONNX Runtime, BGE models) |
| `commander` | ^13.0.0 | CLI framework |
| `gray-matter` | ^4.0.3 | YAML frontmatter parsing |
| `smol-toml` | ^1.6.0 | TOML parsing/serialization |
| `@biomejs/biome` | ^1.9.0 | Linting + formatting |
| `tsup` | ^8.0.0 | TypeScript bundler |
| `vitest` | ^3.0.0 | Test framework |
| `typescript` | ^5.7.0 | Type checking |

## Appendix C: Embedding Model Details

**Model**: `BGESmallENV15` (BAAI/bge-small-en-v1.5)
**Dimensions**: 384
**Download size**: ~45MB (cached by fastembed at first use)
**Cache location**: `<os cache dir>/fastembed_cache/`

Usage pattern:
```typescript
import { EmbeddingModel, FlagEmbedding } from "fastembed";

const model = await FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15 });

// Single embedding (for queries)
const queryVector: number[] = await model.queryEmbed("search query");

// Batch embedding (for indexing)
const documents = ["doc1 content", "doc2 content", "doc3 content"];
const batches = model.embed(documents, 32); // batch size 32
for await (const batch of batches) {
  // batch: number[][] — array of 384-dim vectors
}
```

This model was chosen over nomic-embed-text (from BRIEF.md) because fastembed provides a simpler, dependency-light integration path for Node.js. BGE-small-en-v1.5 is competitive on MTEB benchmarks and its 384-dimension vectors keep the sqlite-vec index compact. The model can be changed later by updating `ForestConfig.embedding.model` and reindexing.

## Appendix D: sqlite-vec Usage Pattern

```typescript
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const db = new Database("mycelium.db");
sqliteVec.load(db);

// Create virtual table
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_branches USING vec0(
  branch_id INTEGER PRIMARY KEY,
  embedding FLOAT[384]
)`);

// Insert embedding
const insertStmt = db.prepare(
  `INSERT INTO vec_branches (branch_id, embedding) VALUES (?, ?)`
);
insertStmt.run(branchId, JSON.stringify(vector));

// Query nearest neighbors
const searchStmt = db.prepare(`
  SELECT branch_id, distance
  FROM vec_branches
  WHERE embedding MATCH ?
  ORDER BY distance
  LIMIT ?
`);
const results = searchStmt.all(JSON.stringify(queryVector), 20);
```

## Appendix E: Constitutional Cross-Reference

| Spec Requirement | Constitution Rule |
|------------------|-------------------|
| Tenant isolation in all search functions | 2.1, 4.1, 4.4, 4.5 |
| No cross-domain imports | 2.2 |
| Layering: CLI → Euclid → Mycelium → Forest | 2.3 |
| Markdown is source of truth, DB is derived | 2.4 |
| Tenant resolution at CLI boundary only | 2.5 |
| `strict: true` in tsconfig | 3.1 |
| No comments unless "why" is non-obvious | 3.2 |
| Full-word naming (no abbreviations) | 3.3 |
| Real SQLite in tests (no mocks) | 3.5 |
| Biome for formatting/linting | 3.6 |
| Import sanitization (path traversal prevention) | 4.2 |
| Autonomy levels are constitutional, not configurable | 8.1 |
| All Euclid actions logged with rationale | 8.2 |
| Cross-forest always requires confirmation | 8.3 |
| Euclid operates within one tenant at a time | 8.6 |
