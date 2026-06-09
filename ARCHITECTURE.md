# Memforest Architecture

Technical blueprint for implementing memforest. Covers system topology, domain contracts, storage schema, data flows, and extension points. Read BRIEF.md for *what* memforest does; this document defines *how*.

---

## 1. System Overview

```
                        ┌──────────────────────────────────┐
                        │           User / Agent           │
                        └──────────┬───────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │         src/cli/             │
                    │  Commander.js entry point    │
                    │  Tenant resolution           │
                    │  Output formatting           │
                    │  TUI bootstrap (pi-tui)      │
                    └──────┬───────────┬───────────┘
                           │           │
              non-interactive     interactive
                           │           │
                    ┌──────▼───────────▼───────────┐
                    │        src/euclid/            │
                    │  pi-coding-agent session      │
                    │  Gardening pipelines          │
                    │  Autonomy enforcement         │
                    │  Action logging               │
                    └──────┬───────────────────────┘
                           │
                    ┌──────▼───────────────────────┐
                    │       src/mycelium/           │
                    │  Hybrid search (FTS5+vec+graph)│
                    │  Embedding pipeline           │
                    │  Graph operations             │
                    │  Freshness tracking           │
                    │  Cross-forest query router    │
                    └──────┬───────────────────────┘
                           │
                    ┌──────▼───────────────────────┐
                    │        src/forest/            │
                    │  Tenant lifecycle (CRUD)      │
                    │  Markdown file I/O            │
                    │  Frontmatter parsing          │
                    │  Tree topology management     │
                    │  Wiki-link extraction         │
                    └──────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │ trees/  │  │mycelium│  │forest. │
         │  *.md   │  │  .db   │  │ toml   │
         └─────────┘  └────────┘  └────────┘

  Lateral domains (no layering dependency):

  ┌──────────────┐    ┌──────────────┐
  │ src/import/  │    │ src/skill/   │
  │ Obsidian     │    │ SKILL.md gen │
  │ Generic MD   │    │ Harness      │
  │              │    │ adapters     │
  └──────────────┘    └──────────────┘

  Cross-cutting:

  ┌──────────────────────────────────┐
  │         src/shared/              │
  │  TenantContext, ForestConfig,    │
  │  errors, logging, config loader  │
  └──────────────────────────────────┘
```

### Dependency Direction (constitutional invariant)

```
CLI ──▶ Euclid ──▶ Mycelium ──▶ Forest
                                  ▲
import/ ──────────────────────────┘ (writes via forest public API)
import/ ──▶ mycelium (indexes via mycelium public API)
skill/  ──▶ (no domain deps, reads templates only)
shared/ ◀── (all domains import from shared, shared imports from none)
```

---

## 2. Domain Architecture

### 2.1 `src/shared/`

Cross-cutting types and utilities. Used by every domain. Depends on nothing.

```
src/shared/
  index.ts              # barrel export
  types.ts              # TenantContext, ForestConfig, BranchMeta, etc.
  errors.ts             # Error class hierarchy
  config.ts             # Config loading: global config.toml + forest.toml + CLI flags
  logger.ts             # Structured JSON logger
  tenant-resolver.ts    # Resolve active tenant from config/flags/env
  constants.ts          # File paths, defaults, limits
```

**Key exports:**

```typescript
// --- types.ts ---

interface TenantContext {
  readonly id: string;                    // tenant slug, e.g. "personal"
  readonly forestPath: string;            // e.g. ~/.memforest/forests/personal/
  readonly treesPath: string;             // e.g. ~/.memforest/forests/personal/trees/
  readonly databasePath: string;          // e.g. ~/.memforest/forests/personal/mycelium.db
  readonly config: ForestConfig;          // merged config for this tenant
}

interface ForestConfig {
  readonly name: string;
  readonly description?: string;
  readonly embedding: EmbeddingConfig;
  readonly search: SearchConfig;
  readonly gardening: GardeningConfig;
  readonly createdAt: string;             // ISO 8601
}

interface EmbeddingConfig {
  readonly model: string;                 // default: "BGESmallENV15"
  readonly dimensions: number;            // default: 384
}

interface SearchConfig {
  readonly ftsWeight: number;             // default: 0.3
  readonly vectorWeight: number;          // default: 0.5
  readonly graphWeight: number;           // default: 0.2
  readonly maxResults: number;            // default: 20
}

interface GardeningConfig {
  readonly stalenessThresholdDays: number; // default: 90
  readonly autoLink: boolean;              // default: true
  readonly autoPruneDrafts: boolean;       // default: true
  readonly schedule?: string;              // cron expression
}

interface BranchMeta {
  readonly id: string;                     // unique ID (nanoid)
  readonly title: string;
  readonly tree: string;                   // parent tree directory name
  readonly relativePath: string;           // path relative to trees/
  readonly status: "seed" | "draft" | "active" | "stale" | "archived";
  readonly tags: string[];
  readonly aliases: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly linkedFrom: string[];           // IDs of branches linking TO this
  readonly linksTo: string[];              // IDs of branches this links TO
}

interface SearchResult {
  readonly branchId: string;
  readonly title: string;
  readonly snippet: string;
  readonly score: number;
  readonly forest: string;                 // tenant ID (for cross-forest)
  readonly sources: {
    readonly fts: number;
    readonly vector: number;
    readonly graph: number;
  };
  readonly freshness: number;              // 0.0 (stale) to 1.0 (fresh)
}

interface SynthesizedAnswer {
  readonly answer: string;
  readonly provenance: Array<{
    readonly branchId: string;
    readonly title: string;
    readonly relevance: number;
  }>;
  readonly forest: string;
  readonly confidence: number;
}

// --- errors.ts ---

class MemforestError extends Error {
  constructor(message: string, readonly code: ErrorCode) { super(message); }
}
class TenantNotFoundError extends MemforestError {}
class TenantAlreadyExistsError extends MemforestError {}
class BranchNotFoundError extends MemforestError {}
class DatabaseError extends MemforestError {}
class ImportError extends MemforestError {}
class ValidationError extends MemforestError {}
class AutonomyBoundaryError extends MemforestError {}

type ErrorCode =
  | "TENANT_NOT_FOUND"
  | "TENANT_ALREADY_EXISTS"
  | "BRANCH_NOT_FOUND"
  | "DATABASE_ERROR"
  | "IMPORT_ERROR"
  | "VALIDATION_ERROR"
  | "AUTONOMY_BOUNDARY"
  | "CONFIG_INVALID"
  | "EMBEDDING_FAILED";

// --- config.ts ---

function loadGlobalConfig(): GlobalConfig;
function loadForestConfig(forestPath: string): ForestConfig;
function mergeConfig(
  global: GlobalConfig,
  forest: ForestConfig,
  cliFlags: Partial<ForestConfig>
): ForestConfig;

// --- tenant-resolver.ts ---

function resolveActiveTenant(options?: {
  forestFlag?: string;      // --forest CLI flag
  envOverride?: string;     // MEMFOREST_FOREST env var
}): TenantContext;

function resolveMultipleTenants(forestList: string[]): TenantContext[];
```

### 2.2 `src/forest/`

Tenant lifecycle and markdown file I/O. Bottom of the stack.

```
src/forest/
  index.ts              # barrel: re-exports public API
  tenant.ts             # create, list, delete, archive, use
  branch.ts             # CRUD for individual notes (branches)
  tree.ts               # tree (directory) management
  frontmatter.ts        # parse/serialize YAML frontmatter
  wikilink.ts           # parse [[wiki-links]] from markdown content
  filesystem.ts         # low-level file read/write/move/delete
```

**Public interface:**

```typescript
// --- tenant.ts ---
function createForest(name: string, config?: Partial<ForestConfig>): Promise<TenantContext>;
function listForests(): Promise<Array<{ id: string; path: string; config: ForestConfig }>>;
function deleteForest(id: string): Promise<void>;
function archiveForest(id: string): Promise<void>;
function setActiveForest(id: string): Promise<void>;
function getActiveForest(): Promise<TenantContext | null>;

// --- branch.ts ---
function createBranch(tenant: TenantContext, options: {
  name: string;
  tree: string;
  content: string;
  tags?: string[];
  status?: BranchMeta["status"];
}): Promise<BranchMeta>;

function updateBranch(tenant: TenantContext, id: string, options: {
  content?: string;
  tags?: string[];
  status?: BranchMeta["status"];
}): Promise<BranchMeta>;

function readBranch(tenant: TenantContext, id: string): Promise<{ meta: BranchMeta; content: string }>;
function deleteBranch(tenant: TenantContext, id: string): Promise<void>;
function listBranches(tenant: TenantContext, options?: {
  tree?: string;
  status?: BranchMeta["status"];
  tag?: string;
}): Promise<BranchMeta[]>;

function upsertBranch(tenant: TenantContext, name: string, content: string): Promise<BranchMeta>;

// --- frontmatter.ts ---
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; content: string };
function serializeFrontmatter(meta: Record<string, unknown>, content: string): string;
function validateFrontmatter(meta: Record<string, unknown>): ValidationResult;

// --- wikilink.ts ---
interface WikiLink {
  raw: string;              // e.g. "[[folder/note|alias]]"
  target: string;           // e.g. "folder/note"
  alias?: string;           // e.g. "alias"
  position: { line: number; column: number };
}
function extractWikiLinks(content: string): WikiLink[];
function resolveWikiLink(link: WikiLink, branches: BranchMeta[]): string | null;  // returns branchId
```

**Data owned:** Markdown files under `~/.memforest/forests/<tenant>/trees/`, `forest.toml` per tenant, global `config.toml`.

### 2.3 `src/mycelium/`

Search, indexing, graph, embeddings. Depends on forest types via shared.

```
src/mycelium/
  index.ts              # barrel
  database.ts           # SQLite connection management, schema init, migrations
  fts.ts                # FTS5 indexing and querying
  embeddings.ts         # Embedding generation (fastembed BGESmallENV15), storage
  vector.ts             # sqlite-vec operations: insert, knn query
  graph.ts              # Node/edge CRUD, traversal (BFS/DFS), neighborhood
  search.ts             # Hybrid search orchestrator: FTS + vector + graph → merge + rerank
  freshness.ts          # Staleness scoring, decay detection
  indexer.ts            # Full reindex pipeline: scan files → FTS + embeddings + graph
  synthesizer.ts        # Answer synthesis from search results (uses LLM via Euclid)
```

**Public interface:**

```typescript
// --- database.ts ---
function openDatabase(tenant: TenantContext): Database;
function closeDatabase(db: Database): void;
function initializeSchema(db: Database): void;

// --- search.ts ---
function hybridSearch(db: Database, query: string, options?: {
  mode?: "hybrid" | "fts" | "semantic" | "graph";
  maxResults?: number;
  weights?: { fts: number; vector: number; graph: number };
}): Promise<SearchResult[]>;

// --- graph.ts ---
function addEdge(db: Database, source: string, target: string, kind: EdgeKind): void;
function removeEdge(db: Database, source: string, target: string): void;
function getNeighborhood(db: Database, nodeId: string, options?: {
  depth?: number;          // default: 2
  direction?: "outgoing" | "incoming" | "both";
}): Promise<GraphNeighborhood>;

interface GraphNeighborhood {
  nodes: Array<{ id: string; title: string; depth: number }>;
  edges: Array<{ source: string; target: string; kind: EdgeKind }>;
}

type EdgeKind = "wikilink" | "tag_cooccurrence" | "semantic_similarity" | "manual";

// --- indexer.ts ---
function indexBranch(db: Database, tenant: TenantContext, branchId: string): Promise<void>;
function removeBranchIndex(db: Database, branchId: string): Promise<void>;
function reindexForest(db: Database, tenant: TenantContext): Promise<IndexReport>;

interface IndexReport {
  totalBranches: number;
  indexed: number;
  failed: number;
  edges: number;
  embeddings: number;
  durationMs: number;
}

// --- embeddings.ts ---
function generateEmbedding(text: string, config: EmbeddingConfig): Promise<Float32Array>;
function chunkContent(content: string, config: EmbeddingConfig): string[];

// --- freshness.ts ---
function computeFreshness(branchId: string, db: Database): number;  // 0.0–1.0
function detectStale(db: Database, thresholdDays: number): Promise<string[]>;  // branch IDs

// --- synthesizer.ts ---
// Note: synthesis requires an LLM call. The synthesizer accepts a function
// that performs the LLM completion, injected from euclid layer.
type LLMCompleteFn = (systemPrompt: string, userMessage: string) => Promise<string>;

function synthesizeAnswer(
  results: SearchResult[],
  query: string,
  complete: LLMCompleteFn
): Promise<SynthesizedAnswer>;
```

### 2.4 `src/euclid/`

Agent runtime. Depends on mycelium (via public API) and forest (via shared types).

```
src/euclid/
  index.ts              # barrel
  session.ts            # pi-coding-agent session bootstrap for Euclid
  gardener.ts           # Gardening cycle orchestrator
  autonomy.ts           # Autonomy boundary enforcement
  capabilities/
    plant.ts            # plant-idea pipeline
    research.ts         # research-breakdown pipeline
    prune.ts            # stale pruning logic
    merge.ts            # near-duplicate merging
    link.ts             # auto-linking
  pipeline.ts           # Pipeline runner (sequences of capabilities)
  action-log.ts         # Structured action logging
  prompts/
    gardener-system.md  # Euclid system prompt
    synthesis.md        # Answer synthesis prompt
    plant.md            # Plant-idea prompt template
    research.md         # Research-breakdown prompt template
```

**Public interface:**

```typescript
// --- session.ts ---
function createEuclidSession(tenant: TenantContext, options?: {
  interactive?: boolean;   // TUI mode vs CLI mode
  model?: string;          // LLM model override
}): Promise<EuclidSession>;

interface EuclidSession {
  ask(question: string): Promise<SynthesizedAnswer>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  garden(options?: GardenOptions): Promise<GardenReport>;
  plant(idea: string): Promise<BranchMeta>;
  research(topic: string): Promise<BranchMeta[]>;
  dispose(): Promise<void>;
}

// --- gardener.ts ---
interface GardenOptions {
  dryRun?: boolean;
  watch?: boolean;            // daemon mode
  schedule?: string;          // cron expression
}

interface GardenReport {
  linksAdded: number;
  staleDetected: number;
  draftsPruned: number;
  mergesProposed: number;
  seedsPlanted: number;
  actions: ActionLogEntry[];
  durationMs: number;
}

// --- autonomy.ts ---
type AutonomyLevel = "auto" | "confirm";

interface AutonomyBoundary {
  action: string;
  level: AutonomyLevel;
  description: string;
}

function checkAutonomy(action: string): AutonomyLevel;
function requireConfirmation(action: string, details: string): Promise<boolean>;

// --- action-log.ts ---
interface ActionLogEntry {
  timestamp: string;         // ISO 8601
  action: string;            // e.g. "add_link", "flag_stale", "prune_draft"
  branchId?: string;
  tree?: string;
  tenant: string;
  autonomyLevel: AutonomyLevel;
  rationale: string;
  result: "success" | "skipped" | "confirmed" | "rejected";
}

function logAction(entry: ActionLogEntry): void;
function getActionLog(tenant: TenantContext, options?: {
  since?: string;
  action?: string;
  limit?: number;
}): ActionLogEntry[];
```

### 2.5 `src/import/`

Import pipelines. Lateral domain: depends on forest and mycelium public APIs.

```
src/import/
  index.ts              # barrel
  obsidian.ts           # Obsidian vault import
  markdown.ts           # Generic markdown folder import
  scanner.ts            # File discovery, frontmatter extraction
  link-resolver.ts      # Obsidian wiki-link → memforest edge resolution
  conflict.ts           # Duplicate filename handling, broken link detection
  report.ts             # Import report generation
```

**Public interface:**

```typescript
// --- obsidian.ts ---
function importObsidianVault(
  vaultPath: string,
  tenant: TenantContext,
  options?: ImportOptions
): Promise<ImportReport>;

// --- markdown.ts ---
function importMarkdownFolder(
  folderPath: string,
  tenant: TenantContext,
  options?: ImportOptions
): Promise<ImportReport>;

interface ImportOptions {
  treeMapping?: "preserve" | "flatten";   // default: "preserve"
  dryRun?: boolean;
  skipEmbeddings?: boolean;
}

interface ImportReport {
  totalFiles: number;
  imported: number;
  skipped: number;
  trees: string[];
  branches: number;
  edges: number;
  brokenLinks: string[];
  duplicates: Array<{ original: string; renamed: string }>;
  durationMs: number;
}
```

### 2.6 `src/skill/`

SKILL.md generation. No domain dependencies.

```
src/skill/
  index.ts              # barrel
  generator.ts          # Template rendering
  templates/
    claude-code.md      # Claude Code SKILL template
    opencode.md         # OpenCode SKILL template
    pi.md               # Pi SKILL template
    generic.md          # Generic SKILL template
  harness.ts            # Harness detection and file path resolution
```

**Public interface:**

```typescript
type HarnessType = "claude-code" | "opencode" | "pi" | "generic";

function generateSkill(harness: HarnessType): string;
function installSkill(harness: HarnessType, targetDir?: string): Promise<string>;  // returns path written
function detectHarness(cwd: string): HarnessType | null;
```

### 2.7 `src/cli/`

CLI entry point. Top of the stack.

```
src/cli/
  index.ts              # Commander.js program definition
  commands/
    init.ts             # memforest init <name>
    list.ts             # memforest list
    use.ts              # memforest use <name>
    ask.ts              # memforest ask "question"
    search.ts           # memforest search "query"
    upsert.ts           # memforest upsert <name> "<content>"
    plant.ts            # memforest plant "<idea>"
    research.ts         # memforest research "<topic>"
    health.ts           # memforest health
    prune.ts            # memforest prune
    link.ts             # memforest link <source> <target>
    graph.ts            # memforest graph <topic>
    garden.ts           # memforest garden
    import.ts           # memforest import obsidian|markdown <path>
    export.ts           # memforest export <path>
    install.ts          # memforest install <harness>
    tui.ts              # memforest tui / memforest (bare)
    reindex.ts          # memforest reindex
    read.ts             # memforest read <path>
  middleware.ts         # Tenant resolution middleware (runs before every command)
  output.ts             # Formatter: JSON for piped output, human-readable for TTY
```

**Public interface:** None (entry point only). Each command file exports a function that registers itself on the Commander program.

---

## 3. Storage Architecture

### 3.1 Markdown Layer

#### File layout

```
~/.memforest/
├── config.toml                         # global config
├── forests/
│   └── <tenant>/
│       ├── forest.toml                 # per-tenant config
│       ├── mycelium.db                 # SQLite database
│       ├── euclid.log                  # structured action log (JSONL)
│       └── trees/
│           ├── domains/
│           │   ├── auth-patterns.md
│           │   └── session-management.md
│           ├── research/
│           │   ├── agent-architectures.md
│           │   └── embedding-models.md
│           └── ideas/
│               └── unified-memory-api.md
```

#### Frontmatter schema

Every markdown file managed by memforest has YAML frontmatter:

```yaml
---
id: "br_a1b2c3d4"            # required: unique branch ID (nanoid, prefixed br_)
title: "Auth Patterns"        # required: human-readable title
tree: "domains"               # required: parent tree directory
status: "active"              # required: seed | draft | active | stale | archived
tags: ["auth", "security"]    # optional: searchable tags
aliases: ["authentication"]   # optional: alternative names for link resolution
created: "2026-05-10T14:00:00Z"  # required: ISO 8601
updated: "2026-05-10T14:00:00Z"  # required: ISO 8601
source: "user"                # optional: user | import | euclid
---
```

**Required fields:** `id`, `title`, `tree`, `status`, `created`, `updated`
**Optional fields:** `tags`, `aliases`, `source`, plus any user-defined fields (preserved but not indexed)

#### Tree topology rules

1. Trees are top-level directories under `trees/`. No nesting of trees.
2. Branches (files) live directly in a tree directory or one level of subdirectory. Maximum depth: `trees/<tree>/<subdir>/<file>.md`.
3. Tree names are slugified: lowercase, alphanumeric + hyphens. `domains`, `research`, `ideas` are conventional defaults.
4. File names are slugified from the branch title: `auth-patterns.md` from title "Auth Patterns".

#### Wiki-link format

```
[[target]]              → link to branch by title or alias
[[tree/target]]         → link to branch in specific tree
[[target|display text]] → link with alias
```

Parsing rules:
- Match regex: `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g`
- Target resolution order: (1) exact title match, (2) alias match, (3) filename stem match
- Unresolvable links are preserved in content, flagged in health reports

### 3.2 Database Layer (SQLite v0)

One `mycelium.db` per tenant. Uses better-sqlite3 with sqlite-vec extension.

#### Complete schema

```sql
-- ============================================================
-- METADATA
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version   INTEGER NOT NULL,
  applied   TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO schema_version (version) VALUES (1);

-- ============================================================
-- BRANCHES (nodes in the graph)
-- ============================================================

CREATE TABLE IF NOT EXISTS branches (
  id            TEXT    PRIMARY KEY,              -- br_<nanoid>
  title         TEXT    NOT NULL,
  tree          TEXT    NOT NULL,
  relative_path TEXT    NOT NULL UNIQUE,           -- path relative to trees/
  status        TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('seed','draft','active','stale','archived')),
  tags          TEXT    NOT NULL DEFAULT '[]',     -- JSON array of strings
  aliases       TEXT    NOT NULL DEFAULT '[]',     -- JSON array of strings
  content_hash  TEXT    NOT NULL,                  -- SHA-256 of markdown content
  created_at    TEXT    NOT NULL,                  -- ISO 8601
  updated_at    TEXT    NOT NULL,                  -- ISO 8601
  source        TEXT    NOT NULL DEFAULT 'user',
  word_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_branches_tree ON branches(tree);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_updated ON branches(updated_at);

-- ============================================================
-- FULL-TEXT SEARCH (FTS5)
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS branches_fts USING fts5(
  title,
  content,
  tags,
  content='',                                     -- external content mode
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Triggers to keep FTS in sync with branches table are not used.
-- FTS is populated explicitly by the indexer after branch insert/update.
-- This avoids storing content twice (content is read from .md files on demand).

-- ============================================================
-- VECTOR EMBEDDINGS (sqlite-vec)
-- ============================================================

-- Branch-level embeddings (v0 simplification — no chunking).
-- Each branch gets a single embedding vector from its full content.
-- Chunking can be added in a later version for longer documents.
-- Dimension 384 matches fastembed BGESmallENV15 output.
CREATE VIRTUAL TABLE IF NOT EXISTS vec_branches USING vec0(
  branch_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
);

-- ============================================================
-- GRAPH (edges between branches)
-- ============================================================

CREATE TABLE IF NOT EXISTS edges (
  source_id     TEXT    NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  target_id     TEXT    NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL DEFAULT 'wikilink'
                        CHECK (kind IN ('wikilink','tag_cooccurrence','semantic_similarity','manual')),
  weight        REAL    NOT NULL DEFAULT 1.0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_id, target_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);

-- ============================================================
-- HEALTH LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS health_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id     TEXT,                              -- NULL for forest-level events
  event_type    TEXT    NOT NULL,                   -- stale_detected, orphan_found, broken_link, etc.
  details       TEXT    NOT NULL DEFAULT '{}',      -- JSON details
  resolved      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_branch ON health_log(branch_id);
CREATE INDEX IF NOT EXISTS idx_health_type ON health_log(event_type);
CREATE INDEX IF NOT EXISTS idx_health_unresolved ON health_log(resolved) WHERE resolved = 0;

-- ============================================================
-- EUCLID ACTION LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS action_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  action        TEXT    NOT NULL,                   -- add_link, flag_stale, prune_draft, etc.
  branch_id     TEXT,
  tree          TEXT,
  autonomy      TEXT    NOT NULL CHECK (autonomy IN ('auto','confirm')),
  rationale     TEXT    NOT NULL,
  result        TEXT    NOT NULL CHECK (result IN ('success','skipped','confirmed','rejected')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_action_log_created ON action_log(created_at);
CREATE INDEX IF NOT EXISTS idx_action_log_action ON action_log(action);
```

#### Index strategy

| Table | Index | Purpose |
|---|---|---|
| `branches` | `idx_branches_tree` | Filter by tree for tree-scoped queries |
| `branches` | `idx_branches_status` | Filter active vs stale vs archived |
| `branches` | `idx_branches_updated` | Freshness ordering |
| `branches_fts` | FTS5 internal | Full-text search with Porter stemming |
| `vec_branches` | sqlite-vec internal | Approximate KNN for semantic search |
| `edges` | `idx_edges_source` / `target` | Graph traversal in both directions |
| `edges` | `idx_edges_kind` | Filter by edge type |
| `health_log` | `idx_health_unresolved` | Quick lookup of open issues |

#### Markdown-to-DB relationship

```
 ┌────────────────────┐         ┌──────────────────┐
 │  auth-patterns.md  │────────▶│  branches row    │
 │                    │         │  id: br_a1b2     │
 │  Content body      │────────▶│  branches_fts    │
 │  (full text)       │         │  (title+content) │
 │                    │         ├──────────────────┤
 │  Full content      │────────▶│  vec_branches    │
 │                    │         │  (384d embedding) │
 │                    │         ├──────────────────┤
 │  [[session-mgmt]]  │────────▶│  edges row       │
 │  (wiki-link)       │         │  src→tgt wikilink│
 └────────────────────┘         └──────────────────┘
```

**Invariant (constitutional):** If the database is deleted, `memforest reindex` rebuilds it entirely from the markdown files. The markdown files are the source of truth. The DB is a derived, disposable index.

---

## 4. Multi-Tenancy

### 4.1 Tenant Lifecycle

| Operation | Description | Artifacts Created/Modified |
|---|---|---|
| `create` | `memforest init <name>` | `forests/<name>/forest.toml`, `forests/<name>/trees/`, `forests/<name>/mycelium.db` |
| `list` | `memforest list` | reads `forests/` directory listing + each `forest.toml` |
| `use` | `memforest use <name>` | updates `config.toml` → `active_forest = "<name>"` |
| `archive` | sets status to archived | updates `forest.toml` → `status = "archived"` |
| `delete` | removes entire forest directory | deletes `forests/<name>/` recursively |

### 4.2 File System Layout

```
~/.memforest/                              # MEMFOREST_HOME (env override)
├── config.toml                            # global config
│   active_forest = "personal"
│   [defaults]
│   embedding_model = "fastembed BGESmallENV15"
│
├── forests/
│   ├── personal/
│   │   ├── forest.toml                    # tenant-specific overrides
│   │   ├── mycelium.db                    # isolated SQLite DB
│   │   ├── euclid.log                     # JSONL action log
│   │   └── trees/
│   │       ├── domains/
│   │       ├── research/
│   │       └── ideas/
│   │
│   ├── work/
│   │   ├── forest.toml
│   │   ├── mycelium.db
│   │   ├── euclid.log
│   │   └── trees/
│   │
│   └── project-x/
│       ├── forest.toml
│       ├── mycelium.db
│       ├── euclid.log
│       └── trees/
```

### 4.3 Config Hierarchy

Resolution order (later wins):

```
1. Built-in defaults (src/shared/constants.ts)
   ↓
2. Global config (~/.memforest/config.toml)
   ↓
3. Forest config (~/.memforest/forests/<tenant>/forest.toml)
   ↓
4. Environment variables (MEMFOREST_*)
   ↓
5. CLI flags (--forest, --mode, etc.)
```

### 4.4 TenantContext Flow

```
  CLI command received
       │
       ▼
  middleware.ts: resolveActiveTenant()
       │  reads --forest flag, env, config.toml
       │  constructs TenantContext
       ▼
  command handler receives TenantContext
       │
       ▼
  passes TenantContext to euclid/mycelium/forest functions
       │  every function that touches data takes TenantContext as arg
       │  no function ever re-resolves tenant
       ▼
  forest.openDatabase(tenant) → opens tenant-specific mycelium.db
  forest.readBranch(tenant, id) → reads from tenant-specific trees/
```

**Constitutional invariant:** TenantContext is resolved once at the CLI boundary. Inner layers receive it as a parameter. No global state, no re-resolution.

### 4.5 Cross-Forest Query Isolation

```
memforest search "auth" --forest personal,work
       │
       ▼
  CLI resolves [TenantContext(personal), TenantContext(work)]
       │
       ▼
  For each tenant (parallel, isolated):
    open tenant-specific DB
    run hybridSearch within that DB
    tag results with tenant.id
    close DB
       │
       ▼
  Return results grouped by forest, never merged:
  {
    "personal": [SearchResult, SearchResult, ...],
    "work": [SearchResult, SearchResult, ...]
  }
```

Results from different forests are never ranked against each other. Each forest's results are independently scored and returned as separate lists.

---

## 5. Mycelium: Search & Retrieval

### 5.1 Hybrid Search Pipeline

```
  Query: "how do sessions work"
       │
       ├───────────────────┬──────────────────┬───────────────────┐
       ▼                   ▼                  ▼                   │
   FTS5 Query         Vector KNN         Graph Expansion          │
   ┌──────────┐     ┌──────────┐       ┌──────────┐              │
   │ tokenize │     │ embed    │       │ find seed │              │
   │ stem     │     │ query    │       │ nodes     │              │
   │ MATCH    │     │ KNN(k=20)│       │ from FTS  │              │
   │ rank     │     │ cosine   │       │ results   │              │
   │ BM25     │     │ sim      │       │ traverse  │              │
   └────┬─────┘     └────┬─────┘       │ depth=2   │              │
        │                │             └────┬──────┘              │
        ▼                ▼                  ▼                     │
   FTS results      Vector results     Graph neighbors            │
   (score 0-1)      (score 0-1)        (score 0-1)               │
        │                │                  │                     │
        └────────────────┴──────────────────┘                     │
                         │                                        │
                         ▼                                        │
                   Merge & Rerank                                 │
                ┌──────────────────┐                              │
                │ union all results│                              │
                │ weighted sum:    │                              │
                │  fts * 0.3       │                              │
                │  vec * 0.5       │                              │
                │  graph * 0.2     │                              │
                │ multiply by      │◀─────── Freshness Score ────┘
                │  freshness coeff │
                │ deduplicate      │
                │ sort by score    │
                │ limit to maxRes  │
                └────────┬─────────┘
                         │
                         ▼
                  SearchResult[]
```

**FTS5 query construction:**

```sql
SELECT
  b.id,
  b.title,
  bm25(branches_fts, 10.0, 1.0, 5.0) AS fts_score
FROM branches_fts
JOIN branches b ON b.rowid = branches_fts.rowid
WHERE branches_fts MATCH ?
ORDER BY fts_score
LIMIT 20;
```

BM25 column weights: title=10.0, content=1.0, tags=5.0.

**Vector KNN query:**

```sql
SELECT
  chunk_id,
  distance
FROM vec_branches
WHERE embedding MATCH ?
  AND k = 20
ORDER BY distance;
```

Returns branch IDs ranked by embedding distance.

**Graph expansion:**

Starting from the top-N FTS/vector results, BFS-traverse edges to depth 2. Each neighbor's score is discounted by `1 / (depth + 1)`.

### 5.2 Embedding Pipeline

```
  Branch content (markdown)
       │
       ▼
  Strip frontmatter
       │
       ▼
  Chunk by token count
  (full branch content)
       │
       ▼
  fastembed BGESmallENV15 → Float32Array[384]
       │
       ▼
  Store in vec_branches table
```

**Embedding granularity (v0):** Branch-level — each branch gets a single embedding from its full content. No chunking in v0. This is simpler and sufficient for vault-scale notes (typically under 2000 tokens). Chunking can be introduced in a later version for long-form documents.

**Embedding model:** `BGESmallENV15` (BAAI/bge-small-en-v1.5) via `fastembed` npm package. Local ONNX Runtime inference, no API dependency. ~45MB model download on first use, cached at `<os cache dir>/fastembed_cache/`. 384-dimensional vectors keep the sqlite-vec index compact.

### 5.3 Graph Model

Wiki-links in markdown content are parsed on write/import and stored as edges.

```
  branches table (nodes)        edges table (edges)
  ┌────────────────┐           ┌────────────────────────────┐
  │ id: br_a1b2    │──────────▶│ source: br_a1b2            │
  │ title: Auth    │           │ target: br_c3d4            │
  │                │           │ kind: wikilink             │
  └────────────────┘           │ weight: 1.0                │
                               └────────────────────────────┘
  ┌────────────────┐
  │ id: br_c3d4    │◀─── (target of the edge above)
  │ title: Session │
  └────────────────┘
```

**Edge kinds:**
- `wikilink` — from `[[target]]` syntax in content. Weight 1.0.
- `tag_cooccurrence` — two branches share one or more tags. Weight = shared tag count / max tag count.
- `semantic_similarity` — computed during indexing when cosine similarity > threshold (0.85). Weight = cosine similarity.
- `manual` — created by `memforest link`. Weight 1.0.

**Traversal patterns:**

```typescript
// BFS neighborhood: returns all nodes within N hops
function bfsNeighborhood(db: Database, startId: string, maxDepth: number): GraphNeighborhood;

// Shortest path between two nodes (unweighted BFS)
function shortestPath(db: Database, fromId: string, toId: string): string[] | null;

// Connected components (for orphan detection)
function findOrphans(db: Database): string[];  // branch IDs with zero edges
```

### 5.4 Freshness Tracking

Freshness is a continuous score from 0.0 (stale) to 1.0 (fresh).

```typescript
function computeFreshness(branch: BranchMeta, config: GardeningConfig): number {
  const daysSinceUpdate = daysBetween(branch.updatedAt, now());
  const threshold = config.stalenessThresholdDays;

  // Linear decay from 1.0 to 0.0 over threshold period
  // Clamped to [0.0, 1.0]
  return Math.max(0, Math.min(1, 1 - (daysSinceUpdate / threshold)));
}
```

Freshness is used as a multiplier on search relevance scores. A note that was updated yesterday gets full score weight. A note untouched for `stalenessThresholdDays` (default: 90) contributes nothing to search ranking.

Staleness detection runs during `memforest garden` and `memforest health`. Notes below freshness 0.2 are flagged in the `health_log` table.

---

## 6. Euclid: Agent Runtime

### 6.1 Wiring to pi-coding-agent

Euclid is a pi-coding-agent session with a custom system prompt, custom tools, and domain-specific capabilities. Integration uses the `Agent` runtime from `@earendil-works/pi-agent-core` (the official pi-core suite — no forks).

```typescript
// src/euclid/session.ts

import { Agent } from "@earendil-works/pi-agent-core";

async function createEuclidSession(tenant: TenantContext, options?: EuclidOptions): Promise<EuclidSession> {
  const db = openDatabase(tenant);

  // Custom tools that Euclid gets in addition to pi-coding-agent built-ins
  const euclidTools: CustomTool[] = [
    createSearchTool(db, tenant),       // memforest search
    createUpsertTool(db, tenant),       // memforest upsert
    createLinkTool(db, tenant),         // memforest link
    createPruneTool(db, tenant),        // memforest prune
    createHealthTool(db, tenant),       // memforest health
    createGraphTool(db, tenant),        // memforest graph
  ];

  const { session } = await createAgentSession({
    cwd: tenant.forestPath,
    systemPrompt: euclidSystemPrompt,   // loaded from prompts/gardener-system.md
    customTools: euclidTools,
    model: options?.model,              // if specified
  });

  return wrapAsEuclidSession(session, db, tenant);
}
```

For non-interactive commands (`memforest ask`, `memforest search`), Euclid runs in "print mode" — sends one message, collects the response, exits. No TUI, no persistent session.

For interactive mode (`memforest tui`, bare `memforest`), Euclid runs as a full pi-coding-agent interactive session with pi-tui rendering, chat history, and all built-in tools.

### 6.2 The Gardening Cycle

`memforest garden` triggers one maintenance cycle:

```
  Garden cycle start
       │
       ├──▶ 1. Freshness scan
       │       Compute freshness for all branches
       │       Flag branches below threshold → health_log
       │       Autonomy: Auto (observation only)
       │
       ├──▶ 2. Orphan detection
       │       Find branches with zero edges
       │       Log orphans → health_log
       │       Autonomy: Auto (observation only)
       │
       ├──▶ 3. Auto-linking
       │       For each branch, scan content for potential links
       │       If title/alias of another branch appears in content → add edge
       │       Autonomy: Auto (low risk, reversible)
       │
       ├──▶ 4. Draft pruning
       │       Find draft-status branches older than threshold
       │       Delete them
       │       Autonomy: Auto (drafts are ephemeral)
       │
       ├──▶ 5. Near-duplicate detection
       │       Find branch pairs with cosine similarity > 0.92
       │       Propose merges → logged, not executed
       │       Autonomy: Confirm (content mutation)
       │
       ├──▶ 6. Seed planting (optional)
       │       Analyze graph gaps (clusters with few inter-links)
       │       Generate seed notes for bridging topics
       │       Autonomy: Auto (seeds are draft status)
       │
       └──▶ 7. Report
              Compile GardenReport
              Write to euclid.log
              Return to CLI for display
```

`--watch` mode: runs this cycle in a loop with configurable interval (default: 6 hours).
`--schedule "cron"` mode: registers a cron-like timer using `node-cron` or equivalent.

### 6.3 Autonomy Enforcement

The autonomy boundary table from BRIEF.md is encoded as a static map:

```typescript
// src/euclid/autonomy.ts

const AUTONOMY_BOUNDARIES: Record<string, AutonomyLevel> = {
  "add_link":                "auto",
  "update_freshness":        "auto",
  "flag_stale":              "auto",
  "flag_orphan":             "auto",
  "plant_seed":              "auto",
  "initiate_research":       "auto",
  "prune_draft":             "auto",
  "merge_duplicates":        "confirm",
  "prune_active":            "confirm",
  "modify_content":          "confirm",
  "cross_forest_operation":  "confirm",
};

function checkAutonomy(action: string): AutonomyLevel {
  const level = AUTONOMY_BOUNDARIES[action];
  if (!level) {
    // Unknown actions default to confirm (conservative)
    return "confirm";
  }
  return level;
}
```

When an action requires confirmation:
- Non-interactive mode: operation is skipped, logged as `"skipped"`, included in report
- Interactive mode: Euclid presents the proposed action to the user, waits for yes/no

**Constitutional constraint:** These boundaries are not configurable. Changing an action from `confirm` to `auto` requires a human-approved amendment to CONSTITUTION.md and BRIEF.md.

### 6.4 Pipeline Integration

plant-idea and research-breakdown are Euclid capabilities:

```typescript
// src/euclid/capabilities/plant.ts

async function plantIdea(
  idea: string,
  tenant: TenantContext,
  db: Database
): Promise<BranchMeta> {
  // 1. Generate a seed note from the idea text
  //    Uses LLM to distill, expand, and structure
  // 2. Create a branch with status: "seed"
  // 3. Index the new branch (FTS + embeddings)
  // 4. Auto-link to related existing branches
  // 5. Log the action
  // 6. Return the new BranchMeta
}

// src/euclid/capabilities/research.ts

async function researchTopic(
  topic: string,
  tenant: TenantContext,
  db: Database
): Promise<BranchMeta[]> {
  // 1. Search existing forest for related content
  // 2. Identify knowledge gaps
  // 3. Generate research breakdown (sub-topics)
  // 4. For each sub-topic, create a seed branch
  // 5. Link sub-topic branches to parent and each other
  // 6. Return all created branches
}
```

### 6.5 Action Logging

Every Euclid action produces a structured log entry. The action log is stored both in the SQLite `action_log` table and appended to `euclid.log` (JSONL format) for external consumption.

```jsonl
{"timestamp":"2026-05-10T14:30:00Z","action":"add_link","branchId":"br_a1b2","tree":"domains","tenant":"personal","autonomy":"auto","rationale":"Title 'Session Management' appears in content of 'Auth Patterns'","result":"success"}
{"timestamp":"2026-05-10T14:30:01Z","action":"flag_stale","branchId":"br_e5f6","tree":"research","tenant":"personal","autonomy":"auto","rationale":"Last updated 120 days ago, freshness 0.0","result":"success"}
{"timestamp":"2026-05-10T14:30:02Z","action":"merge_duplicates","branchId":"br_g7h8","tree":"domains","tenant":"personal","autonomy":"confirm","rationale":"Cosine similarity 0.95 with br_i9j0","result":"skipped"}
```

---

## 7. Import Pipeline

### 7.1 Obsidian Import

```
  memforest import obsidian ~/my-vault
       │
       ▼
  1. SCAN
       │  Walk ~/my-vault/ recursively
       │  Collect all *.md files
       │  Skip .obsidian/, .trash/, .git/
       │  Parse frontmatter from each file
       │  Extract wiki-links from content
       │
       ▼
  2. MAP
       │  Obsidian folder structure → memforest trees
       │  Top-level folders become trees
       │  Root-level files go into "uncategorized" tree
       │  Sanitize folder/file names to slugs
       │
       ▼
  3. CONFLICT RESOLUTION
       │  Detect duplicate filenames across folders
       │  Disambiguate: prefix with tree name
       │    e.g., "domains/auth.md" + "research/auth.md"
       │    → "domains-auth.md" + "research-auth.md"
       │  Assign unique branch IDs (br_<nanoid>)
       │
       ▼
  4. WRITE
       │  For each file:
       │    Normalize frontmatter (add missing id, tree, status, timestamps)
       │    Preserve existing frontmatter fields
       │    Write to trees/<tree>/<file>.md
       │
       ▼
  5. LINK RESOLUTION
       │  Build title→branchId lookup table
       │  Build alias→branchId lookup table
       │  For each wiki-link found in step 1:
       │    Resolve target → branchId
       │    If resolved: INSERT INTO edges
       │    If unresolved: add to brokenLinks list
       │
       ▼
  6. INDEX
       │  For each imported branch:
       │    Index in FTS5 (title + content + tags)
       │    Generate branch-level embedding
       │    Store in vec_branches
       │
       ▼
  7. HEALTH CHECK
       │  Run Euclid health scan on imported data
       │  Detect orphans, broken links, near-duplicates
       │  Write findings to health_log
       │
       ▼
  8. REPORT
       │  Return ImportReport with stats
       │  Display human-readable summary
```

### 7.2 Link Resolution

Obsidian wiki-link variants and their resolution:

| Obsidian Format | Target | Resolution |
|---|---|---|
| `[[Note Title]]` | `Note Title` | Match by title, then alias, then filename stem |
| `[[folder/Note]]` | `folder/Note` | Match by relative path within vault |
| `[[Note\|display text]]` | `Note` | Match by title (alias ignored for resolution) |
| `[[Note#heading]]` | `Note` | Match by title (heading anchor stripped, not stored) |
| `[[Note#heading\|text]]` | `Note` | Same as above |

Resolution algorithm:

```typescript
function resolveObsidianLink(
  target: string,
  titleIndex: Map<string, string>,   // title → branchId
  aliasIndex: Map<string, string>,   // alias → branchId
  pathIndex: Map<string, string>     // relative path → branchId
): string | null {
  // 1. Strip heading anchor (#...)
  const cleanTarget = target.split("#")[0].trim();

  // 2. Try exact title match (case-insensitive)
  const byTitle = titleIndex.get(cleanTarget.toLowerCase());
  if (byTitle) return byTitle;

  // 3. Try alias match
  const byAlias = aliasIndex.get(cleanTarget.toLowerCase());
  if (byAlias) return byAlias;

  // 4. Try path match (for folder/Note syntax)
  const byPath = pathIndex.get(cleanTarget);
  if (byPath) return byPath;

  // 5. Try filename stem match (without extension)
  const stem = cleanTarget.split("/").pop();
  if (stem) {
    const byStem = titleIndex.get(stem.toLowerCase());
    if (byStem) return byStem;
  }

  return null;  // unresolvable → flagged in health report
}
```

### 7.3 Conflict Handling

**Duplicate filenames:**
When two files in different Obsidian folders have the same name (e.g., `daily/tasks.md` and `work/tasks.md`), they are disambiguated by prefixing the tree name: `daily-tasks.md` and `work-tasks.md`. The original title from frontmatter (or filename) is preserved in the `title` field. The slug is only for the filesystem.

**Broken links:**
Wiki-links that cannot be resolved to any imported branch are:
1. Preserved in the markdown content as-is (no modification)
2. Logged in `health_log` with `event_type = 'broken_link'`
3. Listed in the `ImportReport.brokenLinks` array
4. Available for Euclid to resolve during future gardening cycles

### 7.4 Generic Markdown Import

`memforest import markdown <path>` follows the same pipeline but without Obsidian-specific logic:
- No `.obsidian/` directory to skip
- Frontmatter parsing still applies (YAML frontmatter if present, otherwise inferred)
- Wiki-links parsed with the same regex
- Folder structure mapped to trees identically

---

## 8. CLI & TUI Architecture

### 8.1 CLI Command Routing

```typescript
// src/cli/index.ts

import { Command } from "commander";

const program = new Command()
  .name("memforest")
  .description("Agent-native memory substrate")
  .version(VERSION);

// Hook: resolve tenant before every command (except init, list, install)
program.hook("preAction", async (thisCommand) => {
  const skipTenant = ["init", "list", "install"].includes(thisCommand.name());
  if (!skipTenant) {
    const tenant = await resolveActiveTenant({
      forestFlag: thisCommand.opts().forest,
    });
    thisCommand.setOptionValue("_tenant", tenant);
  }
});

// Register commands
registerInitCommand(program);
registerListCommand(program);
registerUseCommand(program);
registerAskCommand(program);
registerSearchCommand(program);
registerUpsertCommand(program);
registerPlantCommand(program);
registerResearchCommand(program);
registerHealthCommand(program);
registerPruneCommand(program);
registerLinkCommand(program);
registerGraphCommand(program);
registerGardenCommand(program);
registerImportCommand(program);
registerExportCommand(program);
registerInstallCommand(program);
registerTuiCommand(program);
registerReindexCommand(program);
registerReadCommand(program);

// Default action: launch TUI if no command given
program.action(async (options) => {
  await launchTui(options._tenant);
});

program.parse();
```

### 8.2 Tenant Resolution Before Dispatch

The `preAction` hook runs `resolveActiveTenant()` before every command (except `init`, `list`, `install`). Resolution order:

1. `--forest <name>` CLI flag → exact match in `~/.memforest/forests/`
2. `MEMFOREST_FOREST` env var → exact match
3. `config.toml` → `active_forest` value
4. If none found → error: "No active forest. Run `memforest init <name>` or `memforest use <name>`"

The resolved `TenantContext` is attached to the command options and passed into all domain function calls.

### 8.3 TUI Architecture

Interactive mode uses pi-tui for rendering and pi-coding-agent for the agent session.

```
  memforest tui (or bare memforest)
       │
       ▼
  resolveActiveTenant()
       │
       ▼
  createEuclidSession(tenant, { interactive: true })
       │  boots pi-coding-agent with Euclid system prompt
       │  registers custom tools (search, upsert, link, etc.)
       │
       ▼
  pi-tui renders:
       │  ┌──────────────────────────────────┐
       │  │  Memforest — personal             │
       │  │                                    │
       │  │  Euclid: How can I help?           │
       │  │                                    │
       │  │  You: what do we know about auth?  │
       │  │                                    │
       │  │  Euclid: Based on 3 branches...    │
       │  │  [provenance links]                │
       │  │                                    │
       │  │  > _                               │
       │  └──────────────────────────────────┘
       │
  Chat loop managed by pi-coding-agent AgentSession
  Agent has access to all Euclid tools + built-in pi tools (bash, read, edit, etc.)
  Session persisted via pi-coding-agent SessionManager
```

### 8.4 Non-Interactive vs Interactive Output

```typescript
// src/cli/output.ts

function formatOutput(data: unknown, options: { json?: boolean }): string {
  // If stdout is not a TTY (piped), or --json flag, output JSON
  if (!process.stdout.isTTY || options.json) {
    return JSON.stringify(data, null, 2);
  }

  // Otherwise, human-readable format
  return formatHumanReadable(data);
}
```

Non-interactive commands (`ask`, `search`, `upsert`) detect whether stdout is a TTY:
- **TTY (interactive terminal):** Human-readable formatted output with colors (via chalk)
- **Piped (non-TTY):** JSON output, machine-parseable, no colors

This makes every CLI command both human-usable and agent-consumable without separate flags.

---

## 9. SKILL.md Generation

### 9.1 Template Structure

Each harness template follows the same structure:

```markdown
---
name: memforest
description: Agent-native memory substrate for knowledge management
globs: ["**/*"]
alwaysApply: true
---

# Memforest — Memory Commands

You have access to `memforest`, a knowledge forest CLI. Use it to store,
retrieve, and manage knowledge.

## Commands

### Query
- `memforest ask "question"` — Get a synthesized answer with provenance
- `memforest search "query"` — Ranked search results
- `memforest read <path>` — Read a specific branch

### Write
- `memforest upsert <name> "<content>"` — Create or update a branch
- `memforest plant "<idea>"` — Plant a new idea seed
- `memforest research "<topic>"` — Research breakdown on a topic
- `memforest link <source> <target>` — Create a link between branches

### Maintenance
- `memforest health` — Forest health report
- `memforest garden` — Run a maintenance cycle

## Usage Rules
- Always use `memforest ask` before searching files manually
- Store new knowledge with `memforest upsert`, not raw file writes
- Trust provenance — answers include source references
```

### 9.2 Harness-Specific Adaptations

| Harness | Output Path | Differences |
|---|---|---|
| `claude-code` | `.claude/skills/memforest/SKILL.md` | Uses Claude Code SKILL frontmatter (name, description, globs, alwaysApply) |
| `opencode` | `.opencode/skills/memforest/SKILL.md` | Same frontmatter schema as claude-code |
| `pi` | `SKILL.md` (project root) | Pi SKILL format (same frontmatter) |
| `generic` | stdout or specified path | Minimal frontmatter, maximum portability |

### 9.3 Install Detection

```typescript
// src/skill/harness.ts

function detectHarness(cwd: string): HarnessType | null {
  if (existsSync(join(cwd, ".claude"))) return "claude-code";
  if (existsSync(join(cwd, ".opencode"))) return "opencode";
  if (existsSync(join(cwd, "SKILL.md"))) return "pi";
  return null;
}

async function installSkill(harness: HarnessType, targetDir?: string): Promise<string> {
  const template = loadTemplate(harness);
  const dir = targetDir ?? getDefaultDir(harness);
  const outputPath = join(dir, getSkillPath(harness));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, template);

  return outputPath;
}
```

---

## 10. Data Flow Diagrams

### 10.1 `memforest ask "question"`

```
  User: memforest ask "how do sessions work"
       │
       ▼
  CLI: resolveActiveTenant() → TenantContext(personal)
       │
       ▼
  CLI: createEuclidSession(tenant, { interactive: false })
       │  boots pi-coding-agent in print mode
       │
       ▼
  Euclid.ask("how do sessions work")
       │
       ├──▶ mycelium.hybridSearch(db, "how do sessions work")
       │       ├── FTS5: MATCH "sessions work" → ranked branches
       │       ├── Vector: embed query → KNN(k=20) → similar branches
       │       └── Graph: expand top results → related branches
       │       │
       │       └──▶ Merge & rerank → SearchResult[]
       │
       ├──▶ mycelium.synthesizeAnswer(results, query, llmComplete)
       │       │
       │       ├── Build prompt with search results as context
       │       ├── Call LLM (via pi-coding-agent model)
       │       └── Return SynthesizedAnswer with provenance
       │
       ▼
  CLI: formatOutput(answer)
       │  TTY: "Based on 3 sources:\n..."
       │  Pipe: { "answer": "...", "provenance": [...] }
       │
       ▼
  Euclid session disposed. DB closed.
```

### 10.2 `memforest upsert <name> "<content>"`

```
  User: memforest upsert "auth-patterns" "JWT vs session cookies..."
       │
       ▼
  CLI: resolveActiveTenant() → TenantContext(personal)
       │
       ▼
  forest.upsertBranch(tenant, "auth-patterns", content)
       │
       ├──▶ Check if branch "auth-patterns" exists (by title/filename)
       │       │
       │       ├── EXISTS: update content, bump updated_at
       │       │     Write to trees/<tree>/auth-patterns.md
       │       │
       │       └── NOT EXISTS: create new branch
       │             Assign br_<nanoid> ID
       │             Default tree: "uncategorized" (or inferred)
       │             Write to trees/<tree>/auth-patterns.md
       │
       ▼
  mycelium.indexBranch(db, tenant, branchId)
       │
       ├──▶ Extract wiki-links from content → edges
       ├──▶ Index in FTS5 (title + content + tags)
       ├──▶ Embed full content → store in vec_branches
       └──▶ Compute tag co-occurrence edges
       │
       ▼
  CLI: formatOutput(branchMeta)
       │  "Created: auth-patterns (br_a1b2) in domains/"
```

### 10.3 `memforest import obsidian <path>`

```
  User: memforest import obsidian ~/my-vault
       │
       ▼
  CLI: resolveActiveTenant() → TenantContext(personal)
       │
       ▼
  import.importObsidianVault("~/my-vault", tenant)
       │
       ├──▶ scanner.scanDirectory("~/my-vault")
       │       Walk recursively, skip .obsidian/ .git/ .trash/
       │       Collect 500 .md files
       │       Parse frontmatter, extract wiki-links
       │       Result: ScannedFile[]
       │
       ├──▶ Map folders to trees
       │       daily/ → tree "daily"
       │       projects/ → tree "projects"
       │       root files → tree "uncategorized"
       │
       ├──▶ conflict.resolveConflicts(scannedFiles)
       │       Detect duplicate filenames across trees
       │       Disambiguate with tree prefix
       │
       ├──▶ For each file (batch):
       │       forest.createBranch(tenant, { name, tree, content, tags })
       │       Writes normalized .md to trees/<tree>/
       │
       ├──▶ link-resolver.resolveAllLinks(scannedFiles, branches)
       │       Build title/alias/path lookup indexes
       │       For each wiki-link: resolve → edge or broken
       │       mycelium.addEdge() for each resolved link
       │
       ├──▶ mycelium.reindexForest(db, tenant)
       │       Batch FTS5 indexing
       │       Batch embedding generation
       │       Batch vec_branches insertion
       │
       └──▶ report.generateReport(stats)
              total: 500, imported: 497, skipped: 3
              trees: 12, branches: 497, edges: 1,843
              brokenLinks: 23
              durationMs: 45,000
```

### 10.4 `memforest garden`

```
  User: memforest garden
       │
       ▼
  CLI: resolveActiveTenant() → TenantContext(personal)
       │
       ▼
  euclid.garden(tenant)
       │
       ├──1. freshness.detectStale(db, threshold=90)
       │       Scan all branches, compute freshness scores
       │       Flag branches below 0.2 → health_log entries
       │       Log action: flag_stale (auto) for each
       │
       ├──2. graph.findOrphans(db)
       │       Find branches with zero edges (in or out)
       │       Flag → health_log
       │       Log action: flag_orphan (auto)
       │
       ├──3. Auto-linking pass
       │       For each branch, scan content for mentions of other branch titles
       │       If title X appears in content of branch Y:
       │         graph.addEdge(Y, X, "wikilink")
       │         Log action: add_link (auto)
       │
       ├──4. Draft pruning
       │       Find branches: status="draft" AND updated_at < 30 days ago
       │       forest.deleteBranch(tenant, id)
       │       mycelium.removeBranchIndex(db, id)
       │       Log action: prune_draft (auto)
       │
       ├──5. Near-duplicate detection
       │       For each branch pair with cosine_sim > 0.92:
       │         Log action: merge_duplicates (confirm) → result: skipped
       │         (non-interactive: skip. interactive: prompt user)
       │
       ├──6. Seed planting
       │       Analyze graph for weakly connected clusters
       │       For gaps: generate seed notes via LLM
       │       forest.createBranch(status: "seed")
       │       mycelium.indexBranch(db, tenant, newId)
       │       Log action: plant_seed (auto)
       │
       └──7. Compile GardenReport
              Return stats to CLI for display
```

### 10.5 `memforest search "query" --forest a,b`

```
  User: memforest search "auth" --forest personal,work
       │
       ▼
  CLI: resolveMultipleTenants(["personal", "work"])
       │  Returns [TenantContext(personal), TenantContext(work)]
       │
       ▼
  For each tenant (Promise.all, parallel, isolated):
       │
       ├──▶ TenantContext(personal):
       │       db = openDatabase(personal)
       │       results = hybridSearch(db, "auth")
       │       tag each result: forest = "personal"
       │       closeDatabase(db)
       │
       └──▶ TenantContext(work):
               db = openDatabase(work)
               results = hybridSearch(db, "auth")
               tag each result: forest = "work"
               closeDatabase(db)
       │
       ▼
  Aggregate (no merging):
  {
    "personal": [
      { title: "Auth Patterns", score: 0.92, forest: "personal", ... },
      { title: "JWT Setup", score: 0.85, forest: "personal", ... }
    ],
    "work": [
      { title: "SSO Integration", score: 0.88, forest: "work", ... },
      { title: "Auth Middleware", score: 0.76, forest: "work", ... }
    ]
  }
       │
       ▼
  CLI: formatOutput(groupedResults)
       TTY: "## personal\n1. Auth Patterns (0.92)\n..."
       Pipe: JSON grouped by forest
```

---

## 11. Error Handling Strategy

### 11.1 Error Boundaries

Errors are caught at domain boundaries. Each domain exposes typed errors from `shared/errors.ts`. No raw exceptions cross domain boundaries.

```
  CLI layer
    │
    │ catches: MemforestError (all types)
    │ formats: human-readable error message (TTY) or JSON error (pipe)
    │ never: exposes stack traces to users (debug mode only)
    │
    ▼
  Euclid layer
    │
    │ catches: mycelium errors, forest errors
    │ wraps: in MemforestError if needed
    │ logs: to action_log with rationale
    │ never: lets pi-coding-agent errors leak tenant data
    │
    ▼
  Mycelium layer
    │
    │ catches: SQLite errors (better-sqlite3), embedding errors
    │ wraps: in DatabaseError or EmbeddingError
    │ never: includes tenant paths in error messages
    │
    ▼
  Forest layer
    │
    │ catches: filesystem errors (ENOENT, EACCES, etc.)
    │ wraps: in BranchNotFoundError, TenantNotFoundError, etc.
    │ never: includes other tenant's paths in error messages
```

### 11.2 Error Types Hierarchy

```
MemforestError (base)
├── TenantNotFoundError       code: TENANT_NOT_FOUND
├── TenantAlreadyExistsError  code: TENANT_ALREADY_EXISTS
├── BranchNotFoundError       code: BRANCH_NOT_FOUND
├── DatabaseError             code: DATABASE_ERROR
│   └── wraps: better-sqlite3 native errors
├── ImportError               code: IMPORT_ERROR
│   └── includes: file path (within import source only, never tenant paths)
├── ValidationError           code: VALIDATION_ERROR
│   └── includes: field name, expected format
├── EmbeddingError            code: EMBEDDING_FAILED
│   └── wraps: fastembed/ONNX runtime errors
├── AutonomyBoundaryError     code: AUTONOMY_BOUNDARY
│   └── includes: action name, required level
└── ConfigError               code: CONFIG_INVALID
    └── includes: config key, expected type
```

### 11.3 Tenant Isolation in Error Paths

**Constitutional invariant:** Error messages, stack traces, and log entries must never include data from a tenant other than the current one.

Enforcement:
1. All error constructors receive tenant context; sanitize before including paths
2. Cross-forest errors are generic: "Forest not found" not "Forest at /path/to/other/forest not found"
3. Database errors strip absolute paths; show only relative path within the current forest
4. Stack traces in production mode are suppressed; only error code and message shown

---

## 12. Extension Points

### 12.1 New Import Formats

To add a new import format (e.g., Notion, Roam):

```
src/import/
  notion.ts             # New file
```

Implement the same interface as `obsidian.ts`:

```typescript
// src/import/notion.ts

export async function importNotionExport(
  exportPath: string,
  tenant: TenantContext,
  options?: ImportOptions
): Promise<ImportReport> {
  // 1. Scan: read Notion export structure (CSV/JSON/markdown)
  // 2. Map: convert Notion pages to branches, databases to trees
  // 3. Resolve: Notion page links → memforest edges
  // 4. Write: forest.createBranch() for each page
  // 5. Index: mycelium.indexBranch() for each
  // 6. Report: return ImportReport
}
```

Register the new format in the CLI:

```typescript
// src/cli/commands/import.ts
importCommand
  .command("notion <path>")
  .action(async (path, options) => {
    await importNotionExport(path, options._tenant);
  });
```

### 12.2 New Search Modes

The search orchestrator in `src/mycelium/search.ts` accepts a `mode` parameter. To add a new search mode:

1. Implement the scoring function in a new file under `src/mycelium/`
2. Add the mode to the `SearchMode` union type in `shared/types.ts`
3. Add a case to the search orchestrator's mode switch

```typescript
// Example: adding a "temporal" mode that ranks by recency
// src/mycelium/temporal.ts

export function temporalSearch(
  db: Database,
  query: string,
  maxResults: number
): SearchResult[] {
  // FTS5 match filtered by date range, scored by recency
}
```

### 12.3 Euclid Capability Extension

To add a new Euclid capability (e.g., "summarize tree"):

```
src/euclid/capabilities/
  summarize.ts          # New file
```

```typescript
export async function summarizeTree(
  tree: string,
  tenant: TenantContext,
  db: Database,
  complete: LLMCompleteFn
): Promise<string> {
  const branches = await listBranches(tenant, { tree });
  // aggregate content, call LLM, return summary
}
```

Register as a custom tool in the Euclid session and add a CLI command.

### 12.4 New Agent Harness Adapters

To add a new harness (e.g., `cursor`):

1. Create a template: `src/skill/templates/cursor.md`
2. Add the type to `HarnessType`: `"cursor"`
3. Add detection logic in `harness.ts`: check for `.cursor/` directory
4. Add output path mapping: `.cursor/skills/memforest/SKILL.md`

No domain logic changes required. The skill content is the same; only the output location and frontmatter format differ.

---

## Appendix: Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `commander` | ^12 | CLI framework |
| `better-sqlite3` | ^12 | SQLite driver (synchronous API, WAL mode) |
| `sqlite-vec` | ^0.1 | Vector similarity search extension |
| `@earendil-works/pi-agent-core` | ^0.75 | Agent runtime (session, tools, capabilities) |
| `@earendil-works/pi-tui` | ^0.75 | Terminal UI (interactive mode) |
| `@earendil-works/pi-ai` | ^0.75 | LLM abstraction (model registry, completion) |
| `nanoid` | ^5 | ID generation (br_, ch_ prefixes) |
| `gray-matter` | ^4 | YAML frontmatter parsing |
| `chalk` | ^5 | Terminal colors |
| `fastembed` | latest | Local embedding model |
| `toml` | ^3 | TOML config parsing |
| `node-cron` | ^3 | Cron scheduling for garden --schedule |
| `tsup` | latest | Build tool |
| `vitest` | latest | Test framework |
| `biome` | latest | Linting and formatting |

## Appendix: Runtime Requirements

- **Bun** >= 1.3.7 (aligned with pi-coding-agent requirement)
- **Node.js** compatibility not required (Bun-native, uses `bun:sqlite` as alternative to better-sqlite3 where available)
- **SQLite** compiled with FTS5 enabled (default in better-sqlite3 and bun:sqlite)
- **sqlite-vec** native extension loaded at runtime
- **Disk**: ~10MB per 1000 notes (markdown + SQLite DB with embeddings)
- **Memory**: Embedding generation is the peak consumer; fastembed BGESmallENV15 requires ~200MB during batch import (~45MB model + runtime overhead)
