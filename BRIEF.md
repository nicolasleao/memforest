# Memforest — Project Brief

## One-Line

Open-source, multi-tenant, agent-native memory substrate — a living knowledge forest managed by Euclid, the autonomous gardener agent.

## Problem

Current context pipelines suffer from fundamental friction:

- **qmd** provides search (BM25 + vector) but is a passive index — no intelligence, no graph awareness, no feedback loops
- **Obsidian** provides visualization but is a human tool — agents can't use it, and it creates vendor dependency for what should be infrastructure
- **Skills** (plant-idea, research-breakdown, company-context-management) are powerful but disconnected — each reimplements vault access patterns independently
- **No unified CLI** — agents must know qmd commands, vault conventions, frontmatter formats, folder structures. Convention-over-infrastructure breaks at scale
- **No feedback loop** — knowledge enters the vault but doesn't self-organize, prune, or surface gaps. Maintenance is a manual bandaid
- **No multi-tenancy** — one vault per human, no isolation between projects, teams, or agent contexts

## Core Axiom

**AI agents need a living, agent-native memory substrate — not human document tools repurposed.**

The vault should be a service, not a folder. Agents should ask questions, not grep files. Memory should grow, link, and prune itself through an intelligent gardener. The system must be multi-tenant from day one — isolation is a security property, not a feature to bolt on later.

## What Memforest Is

A CLI + agent-consumable memory system with three layers:

### Layer 1: Forest (Storage)

Markdown files remain the storage format — portable, inspectable, version-controlled. But memforest owns the structure:

- **Trees** = topic clusters (domains, research packages, idea graphs)
- **Branches** = individual notes within a tree
- **Roots** = the linking substrate connecting branches across trees
- **Rings** = temporal layers within a branch (version history, evolution over time)

Each forest is a **tenant** — fully isolated at the data layer. A user can have many forests: one global, several project-scoped, one per team. Forests never leak data between tenants.

The forest lives at a configurable path (default: `~/.memforest/forests/<tenant>/`). Markdown files with frontmatter — managed by memforest, not by convention.

### Layer 2: Mycelium (Retrieval + Intelligence)

The underground network. Replaces qmd with:

- **Hybrid search**: BM25 full-text + local vector embeddings + graph traversal
- **Relationship awareness**: wiki-links become first-class edges in a queryable graph, not just text patterns
- **Contextual retrieval**: `memforest ask "how do sessions work"` returns synthesized answers with provenance, not ranked file lists
- **Freshness tracking**: knows when knowledge is stale, flags decay, suggests updates
- **Cross-forest search**: query across multiple forests with tenant isolation preserved (results scoped, never merged)

**Multi-tenant storage**:
- **v0 (SQLite)**: One SQLite database per forest/tenant. Complete physical isolation. Each DB contains FTS5 indexes, sqlite-vec embeddings, and graph tables. Zero shared state between tenants
- **v1 (PostgreSQL)**: Single database, one schema per tenant. Schema-level isolation with shared connection pooling. `SET search_path = tenant_<id>` per query. Migration path from v0 → v1 via export/import

### Layer 3: Euclid (The Gardener)

Euclid is the **brain** of the memforest organism — an active, autonomous agent (built on pi-coding-agent) that doesn't just tend the forest but actively grows it:

**Active maintenance:**
- Merges duplicate or near-duplicate notes with provenance tracking
- Updates stale context — detects knowledge decay, refreshes outdated information
- Strengthens weak links, identifies orphans, suggests structural improvements
- Prunes dead branches (with configurable autonomy — auto-prune drafts, ask before pruning active notes)

**Active growth:**
- Plants new ideas autonomously — spots gaps in the forest, generates seed concepts
- Conducts independent research on topics relevant to the existing vault
- Monitors external signals (news, releases, ecosystem changes) relevant to forest domains
- Synthesizes cross-tree insights that no single note captures

**Pipeline orchestration:**
- plant-idea and research-breakdown become Euclid capabilities, not standalone skills
- Runs maintenance cycles on configurable schedules (cron-like or event-driven)

**Self-evolution:**
- Follows GEPA/Hermes patterns: durable skill evolution (offline) + runtime personalization (online)
- Learns from usage patterns — which queries succeed, which notes are accessed most, which links are traversed
- Evolves its own gardening strategies based on forest health metrics

## CLI Interface

```bash
# Forest management
memforest init <name>                                    # create a new forest (tenant)
memforest list                                           # list all forests
memforest use <name>                                     # set active forest
memforest import obsidian <path>                         # import from Obsidian vault
memforest export <path>                                  # export forest as markdown

# Non-interactive (agent-consumable)
memforest ask "what do we know about auth patterns"      # Euclid-synthesized answer
memforest search "auth" --mode hybrid                    # ranked results
memforest upsert <name> "<content>"                      # create/update a branch
memforest plant "<idea text>"                            # run plant-idea pipeline
memforest research "<topic>"                             # run research-breakdown pipeline
memforest health                                         # forest health report
memforest prune --dry-run                                # suggest stale removals
memforest link <source> <target>                         # explicit edge creation
memforest graph <topic>                                  # show local graph neighborhood

# Cross-forest
memforest search "auth" --forest personal,work           # search across specific forests
memforest ask "question" --forest all                    # query all forests (isolated results)

# Euclid autonomous operations
memforest garden                                         # trigger a maintenance cycle
memforest garden --watch                                 # continuous gardening (daemon mode)
memforest garden --schedule "0 */6 * * *"                # schedule regular maintenance

# Interactive (pi-tui)
memforest                                                # opens TUI, chat with Euclid
memforest tui                                            # explicit TUI launch
```

## Agent Integration

Memforest ships as a **SKILL** installable in any agent harness:

```bash
# Claude Code
memforest install claude-code    # writes .claude/skills/memforest.md

# OpenCode
memforest install opencode       # writes .opencode/skills/memforest.md

# Pi Coding Agent
memforest install pi             # writes SKILL.md

# Generic
memforest install --format skill.md > SKILL.md
```

The SKILL instructs agents to use `memforest ask` / `memforest upsert` instead of raw file operations. Agents interact with the forest through Euclid, not through file paths.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                     CLI / TUI                          │
│           (memforest commands, pi-tui)                 │
├───────────────────────────────────────────────────────┤
│                   Euclid Agent                         │
│     (autonomous gardener, synthesis, pipelines,        │
│      active research, self-evolution)                  │
├───────────────────────────────────────────────────────┤
│                    Mycelium                             │
│      (search, embeddings, graph, freshness)            │
├───────────────────────────────────────────────────────┤
│               Tenant Isolation Layer                   │
│    (forest router — resolves tenant, enforces scope)   │
├──────────────┬──────────────┬────────────────────────┤
│  Text Index  │ Vector Store  │  Graph Store            │
│  (FTS5/tsvec)│ (sqlite-vec/  │  (edges/nodes,         │
│              │  pgvector)    │   wiki-link registry)   │
├──────────────┴──────────────┴────────────────────────┤
│                     Forest(s)                          │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│    │ tenant_a│  │ tenant_b│  │ tenant_c│  ...         │
│    │  .md    │  │  .md    │  │  .md    │              │
│    │  .db    │  │  .db    │  │  .db    │              │
│    └─────────┘  └─────────┘  └─────────┘             │
└───────────────────────────────────────────────────────┘
```

## Multi-Tenancy Model

### Principles

1. **Isolation is a security property** — tenant data never leaks, even in error paths
2. **Physical isolation in v0, logical isolation in v1** — SQLite files per tenant → Postgres schemas per tenant
3. **Cross-forest queries are explicit** — `--forest` flag required, results tagged by source, never merged into a single ranked list
4. **Tenant lifecycle is self-contained** — create, import, export, archive, delete operate on one forest atomically

### v0: SQLite Per-Tenant

```
~/.memforest/
├── config.toml                    # global config, active forest
├── forests/
│   ├── personal/
│   │   ├── forest.toml            # tenant config
│   │   ├── mycelium.db            # SQLite: FTS5 + sqlite-vec + graph tables
│   │   └── trees/                 # markdown files
│   │       ├── domains/
│   │       ├── research/
│   │       └── ideas/
│   ├── work/
│   │   ├── forest.toml
│   │   ├── mycelium.db
│   │   └── trees/
│   └── project-x/
│       ├── forest.toml
│       ├── mycelium.db
│       └── trees/
```

### v1: PostgreSQL Schema-Per-Tenant

```sql
-- shared schema
CREATE SCHEMA platform;  -- tenant registry, audit log, global config

-- per-tenant schemas (created on forest init)
CREATE SCHEMA forest_personal;
CREATE SCHEMA forest_work;
CREATE SCHEMA forest_project_x;

-- each tenant schema contains identical table structure:
-- branches (notes), edges (links), embeddings, fts_index, health_log
```

Migration from v0 → v1: `memforest migrate postgres --connection-string "..."`

## Obsidian Import

First-class onboarding experience. Any folder of markdown files works, but optimized for Obsidian vaults:

```bash
memforest import obsidian ~/my-vault
```

**Import process:**

1. **Scan** — discover all `.md` files, parse frontmatter, extract wiki-links
2. **Map** — detect Obsidian folder structure, map to memforest tree topology
3. **Resolve links** — convert Obsidian wiki-links (`[[note]]`, `[[folder/note|alias]]`) to memforest edges
4. **Embed** — generate local embeddings for all content
5. **Index** — build FTS, vector, and graph indexes in the tenant DB
6. **Health check** — run Euclid health scan, report broken links, orphans, duplicates
7. **Report** — summary of imported trees, branches, edges, and health status

**What gets preserved:**
- All markdown content and frontmatter
- Wiki-links → graph edges
- Folder structure → tree topology (configurable: flatten or preserve)
- Tags → searchable metadata
- Aliases → link resolution entries

**What gets dropped:**
- `.obsidian/` config folder (app-specific, not knowledge)
- Plugin data, CSS snippets, workspace layouts
- Canvas files (unsupported in v0, future consideration)

**Conflict handling:**
- Duplicate filenames across folders → disambiguated with tree prefix
- Broken wiki-links → preserved as-is, flagged in health report for Euclid to resolve

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Multi-tenant from day one | Isolation is security, not feature. Retrofitting tenant boundaries is architecture debt |
| SQLite per-tenant in v0 | Physical isolation, zero shared state, trivially portable (copy a folder = clone a forest) |
| Postgres schema-per-tenant in v1 | Logical isolation with shared infra, connection pooling, concurrent multi-agent writes |
| Euclid as active organism brain | The gap isn't search — it's synthesis, maintenance, and autonomous growth |
| Local embeddings (fastembed/BGESmallENV15) | Fast, private, no API dependency, ~45MB model, 384d vectors keep indexes compact |
| Markdown stays as storage | Portable, inspectable, git-friendly, no lock-in |
| CLI-first, TUI-second | Agents consume CLI; humans get TUI as sugar on top |
| SKILL.md as distribution | Proven portable format across Pi/Claude/Codex/OpenCode |
| Obsidian import as onboarding | Largest existing vault user base — meet people where they are |
| Graph as first-class | Wiki-links are edges — the forest IS a graph, treat it as one |
| Open-source from inception | Community-driven growth, transparent governance, contributor-friendly |

## What Memforest Replaces

| Current | Memforest Equivalent |
|---|---|
| `qmd search` | `memforest search` (+ graph-aware, multi-tenant) |
| `qmd vsearch` | `memforest search --mode semantic` |
| `qmd ask` | `memforest ask` (Euclid-powered synthesis) |
| `qmd update` | Automatic on write; `memforest reindex` for manual |
| `qmd get` | `memforest read <path>` |
| Obsidian graph view | `memforest graph` (CLI/TUI visualization) |
| Obsidian vault | `memforest init` + `memforest import obsidian` |
| Manual wiki-link maintenance | Euclid auto-linking + `memforest health` |
| Skill: plant-idea | `memforest plant` (Euclid capability) |
| Skill: research-breakdown | `memforest research` (Euclid capability) |
| Skill: company-context-management | Built-in — Euclid IS context management |
| `/brain-load <topic>` | `memforest ask` / `memforest context <topic>` |

## What Memforest Does NOT Replace

- **Git** — memforest files are still version-controlled by git
- **Agent harnesses** (Claude Code, OpenCode, Pi) — memforest is a tool they use, not a replacement
- **Delivery pipelines** (MSTACK etc.) — memforest is memory infrastructure, not build/ship pipeline
- **Human judgment** — Euclid acts autonomously within boundaries; destructive ops require confirmation

## Euclid Autonomy Boundaries

Euclid's writable surface area follows a risk hierarchy:

| Action | Autonomy Level | Rationale |
|---|---|---|
| Add new links between notes | Auto | Low risk, high value, easily reversible |
| Update freshness metadata | Auto | Bookkeeping, no content change |
| Flag stale/orphan notes | Auto | Observation, not mutation |
| Plant idea seeds (draft status) | Auto | Drafts are non-destructive, clearly marked |
| Initiate research on gap topics | Auto | Produces new content, doesn't modify existing |
| Merge near-duplicate notes | Confirm | Content mutation — Euclid proposes, human approves |
| Prune stale drafts | Auto | Drafts are ephemeral by definition |
| Prune active notes | Confirm | Destructive — requires explicit approval |
| Modify note content (non-metadata) | Confirm | Content is sovereign — Euclid suggests edits, doesn't force them |
| Cross-forest operations | Confirm | Tenant boundary crossing is always explicit |

## Migration Path

**Phase 0 — Local POC (v0)**: TUI-first local proof of concept. Validates the core product loop.
  - **A** — Project scaffold + forest lifecycle (multi-tenant file structure, config with `MEMFOREST_HOME`)
  - **B** — Markdown branches (CRUD, frontmatter, wiki-link extraction)
  - **C** — SQLite index with FTS5 and edges (no vectors in v0)
  - **D** — Retrieval-only ask + health CLI (FTS-backed, no LLM synthesis)
  - **E** — Minimal Euclid TUI (deterministic gardener UI — chat, browse, graph, health panel)

1. **Phase 1 — Vector Search**: Add fastembed + sqlite-vec. Semantic search. Upgrade hybrid search with vector component
2. **Phase 2 — Import**: Obsidian import pipeline. Scan, map, resolve, embed, index, health check. Universal onboarding from any markdown folder
3. **Phase 3 — Euclid Agent Runtime**: Wire pi-coding-agent as Euclid. LLM-backed synthesis. Plant-idea and research-breakdown as capabilities. Active maintenance cycles. Autonomous gardening
4. **Phase 4 — Integration & Distribution**: SKILL.md generation. Install into Claude Code, OpenCode, Pi. Cross-forest search
5. **Phase 5 — Evolution**: Euclid self-improvement (GEPA-style). Usage-pattern learning. External signal monitoring. Autonomous research
6. **Phase 6 — Scale**: PostgreSQL backend. Schema-per-tenant. Concurrent multi-agent writes. Migration tooling from v0

## Open-Source Governance

### Repository Structure

```
memforest/
├── BRIEF.md                # This document — project vision and scope
├── README.md               # User-facing: what it is, how to install, how to use
├── CONSTITUTION.md          # Contributor governance: code standards, architecture rules, security invariants
├── LICENSE                  # MIT or Apache-2.0
├── src/
│   ├── cli/                # CLI entry point, command definitions
│   ├── forest/             # Domain: tenant management, file operations, tree topology
│   ├── mycelium/           # Domain: search, embeddings, graph, indexing
│   ├── euclid/             # Domain: agent runtime, pipelines, maintenance, evolution
│   ├── import/             # Domain: Obsidian import, generic markdown import
│   ├── skill/              # Domain: SKILL.md generation, agent harness adapters
│   └── shared/             # Cross-cutting: config, logging, tenant resolution, types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/                # Plant-idea scripts (distill, germinate, weave)
└── docs/                   # Extended documentation, architecture decisions
```

**Domain-driven organization**: Each domain owns its types, services, and repositories. No cross-domain imports except through `shared/`. The domain boundaries mirror the architectural layers.

### CONSTITUTION.md Scope

The constitution defines:

1. **Code standards** — clean code principles, naming conventions, no-comment-by-default, test expectations
2. **Architecture invariants** — multi-tenancy isolation guarantees, domain boundaries, layering rules
3. **Security properties** — tenant data isolation, no cross-tenant leaks, embedding privacy, import sanitization
4. **Contribution workflow** — PR expectations, review criteria, what Euclid reviews vs. humans review
5. **Agent contributor guidelines** — how AI agents should contribute (respect domain boundaries, run tests, document non-obvious decisions)

## Success Criteria

- Any coding agent can `memforest ask "question"` and get a synthesized, provenanced answer
- `memforest plant` and `memforest research` produce the same quality output as current skills
- Import an Obsidian vault of 500+ notes in under 60 seconds
- Zero Obsidian dependency — the forest is self-contained
- Zero qmd dependency — memforest owns search entirely
- Euclid maintains forest health autonomously within defined boundaries
- Tenant isolation holds under adversarial cross-forest queries
- Install into a new agent harness in one command
- A new contributor (human or agent) can read CONSTITUTION.md and submit a clean PR without prior context

## Tech Stack

- **Language**: TypeScript (aligns with pi-coding-agent, pi-tui ecosystem)
- **CLI framework**: Commander.js or similar
- **TUI**: pi-tui
- **Agent runtime**: pi-coding-agent
- **Database v0**: better-sqlite3 + sqlite-vec (one DB per tenant)
- **Database v1**: PostgreSQL + pgvector (one schema per tenant)
- **Embeddings**: fastembed / BGESmallENV15 (local, fast, private, 384d)
- **FTS**: SQLite FTS5 (v0) / PostgreSQL tsvector (v1)
- **Build**: tsup, single binary via bun compile
- **Distribution**: npm package + compiled binary + SKILL.md generator
- **Testing**: vitest
- **Linting**: biome
