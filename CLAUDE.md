# Memforest — AI Agent Instructions

Multi-tenant, agent-native memory substrate. Living knowledge forest managed by Euclid (autonomous gardener agent).

Three layers: **Forest** (storage) -> **Mycelium** (retrieval) -> **Euclid** (agent).
Full vision: `BRIEF.md`. Architecture rules: `CONSTITUTION.md`.

## Tech Stack

- **Language**: TypeScript
- **CLI**: Commander.js
- **TUI**: pi-tui
- **Agent runtime**: pi-coding-agent
- **DB (v0)**: better-sqlite3 + sqlite-vec (one SQLite DB per tenant)
- **Embeddings**: nomic-embed-text (local, private, no API dependency)
- **FTS**: SQLite FTS5
- **Build**: tsup, bun compile
- **Test**: vitest
- **Lint**: biome

## Domain Structure

```
src/
  cli/        # CLI entry point, command definitions. Top of dependency chain
  forest/     # Tenant management, file ops, tree topology, markdown CRUD
  mycelium/   # Search (FTS5 + sqlite-vec + graph), embeddings, indexing
  euclid/     # Agent runtime, pipelines (plant/research), maintenance cycles
  import/     # Obsidian import, generic markdown import
  skill/      # SKILL.md generation, agent harness adapters
  shared/     # Cross-cutting: config, logging, tenant resolution, types
```

Each domain owns its types, services, and repositories. No cross-domain imports except through `shared/`. Dependency flows top-down only: CLI -> Euclid -> Mycelium -> Forest.

## Development Commands

```bash
bun install          # install deps
bun run build        # compile via tsup
bun run test         # vitest
bun run lint         # biome check
bun run dev          # watch mode
```

## Architecture Rules

### Multi-tenancy
- One SQLite DB per tenant (v0). Physical isolation, zero shared state
- Isolation is non-negotiable — tenant data never leaks, even in error paths
- Cross-forest queries require explicit `--forest` flag; results tagged by source, never merged

### Domain Boundaries
- No cross-domain imports except through `shared/`
- Layering: CLI -> Euclid -> Mycelium -> Forest (top-down only, never reverse)
- Each domain owns its types — no reaching into another domain's internals

### Data
- Markdown is source of truth, DB is derived index
- Wiki-links are first-class graph edges, not text patterns to grep
- Embeddings are local (nomic-embed-text), per-tenant, never shared across forests

### Search
- All search is hybrid: FTS5 + sqlite-vec + graph traversal
- Results include provenance (source forest, branch, freshness)

### Testing
- Real SQLite for DB tests — no mocks for storage layer
- Unit tests for core logic, integration tests for cross-layer flows
- Deterministic: fixed test data, stable assertions, no flaky tests

## Key Patterns

- **Tenant context**: resolved once at CLI boundary, passed as parameter inward. Never global state
- **Wiki-links as edges**: parsed on ingest, stored in graph tables, queryable. Not string matching at read time
- **Embedding lifecycle**: generated on write/import, stored per-tenant in sqlite-vec, refreshed on content change
- **Euclid autonomy**: auto for low-risk ops (add links, flag stale), confirm for mutations (merge, prune active notes)

## Before You Code

1. Read `BRIEF.md` for vision and scope
2. Read `CONSTITUTION.md` for rules
3. Check existing domain boundaries before adding code
4. Run `bun run test && bun run lint` before committing
5. Ground in context vault: `qmd search "<topic>" -c context` (until memforest replaces qmd)

## Commit Style

- Conventional-ish: `forest: add tenant creation` / `mycelium: fix FTS5 tokenizer config`
- Reference domain(s) affected in prefix
- Describe what changed and why
- No emoji in commits

## Agent Roster

This project uses the agent roster defined in the parent workspace. Key agents:
- **Ada** builds. **Turing** designs. **Euclid** writes specs. **Nebula** reviews.
- Planning: Nova -> Kepler -> Turing -> Euclid. Implementation: Ada. Verification: Nebula + Comet.
