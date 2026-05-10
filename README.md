# Memforest

**A multi-tenant, agent-native memory substrate.**

> **Status: Pre-alpha.** Memforest is in active design. The code does not exist yet. This README describes what we are building, not what you can download today. Star and watch if you want to follow along.

---

## What is Memforest

Memforest is a CLI-first knowledge system built for AI agents, not adapted from human document tools. It stores knowledge as markdown, searches it through hybrid retrieval (full-text + vector + graph), and maintains it through an autonomous gardener agent called Euclid. Every forest is a tenant — fully isolated, portable, and self-contained.

## Why

- **Agent context pipelines are duct tape.** Agents grep files, guess at folder conventions, and reimplement vault access patterns independently. There is no unified memory interface.
- **No synthesis, only search.** Current tools return ranked file lists. Agents need answers with provenance, not ten candidate documents to read.
- **Knowledge rots silently.** Notes go stale. Links break. Duplicates accumulate. Nothing detects this, nothing fixes it.
- **No isolation.** One vault per human. No separation between projects, teams, or agent contexts. Multi-tenancy is bolted on as an afterthought, if at all.
- **Human tools repurposed for machines.** Obsidian is excellent for humans. It is not a memory substrate for autonomous agents.

## Architecture

```
┌─────────────────────────────────────────────┐
│               CLI / TUI                      │
├─────────────────────────────────────────────┤
│             Euclid Agent                     │
│   (gardener, synthesis, autonomous growth)   │
├─────────────────────────────────────────────┤
│              Mycelium                        │
│    (hybrid search, embeddings, graph)        │
├─────────────────────────────────────────────┤
│          Tenant Isolation Layer              │
├────────────┬────────────┬───────────────────┤
│ Text Index │   Vector   │   Graph Store     │
│   (FTS5)   │(sqlite-vec)│ (edges, wiki-links│
├────────────┴────────────┴───────────────────┤
│               Forest(s)                      │
│   ┌──────┐  ┌──────┐  ┌──────┐             │
│   │ work │  │ personal │  │ proj-x│  ...    │
│   │ .md  │  │  .md  │  │  .md │             │
│   │ .db  │  │  .db  │  │  .db │             │
│   └──────┘  └──────┘  └──────┘             │
└─────────────────────────────────────────────┘
```

Markdown files are the storage format — portable, inspectable, git-friendly. SQLite databases per tenant hold the indexes. No shared state between forests.

## Quick Start

> **Coming soon.** The installation commands below are placeholders for the planned distribution.

```bash
# Install globally
npm install -g memforest

# Create your first forest
memforest init personal

# Import an existing Obsidian vault
memforest import obsidian ~/my-vault

# Ask a question
memforest ask "what do we know about auth patterns"
```

## CLI Reference

### Forest Management

```bash
memforest init <name>                  # Create a new forest (tenant)
memforest list                         # List all forests
memforest use <name>                   # Set active forest
memforest import obsidian <path>       # Import from Obsidian vault
memforest export <path>                # Export forest as markdown
```

### Search and Retrieval

```bash
memforest ask "how do sessions work"   # Synthesized answer with provenance
memforest search "auth" --mode hybrid  # Ranked results (BM25 + vector + graph)
memforest graph <topic>                # Show local graph neighborhood
memforest health                       # Forest health report
```

### Writing and Linking

```bash
memforest upsert <name> "<content>"    # Create or update a branch
memforest plant "<idea text>"          # Run the plant-idea pipeline
memforest research "<topic>"           # Run the research-breakdown pipeline
memforest link <source> <target>       # Create an explicit edge
memforest prune --dry-run              # Preview stale removals
```

### Cross-Forest Queries

```bash
memforest search "auth" --forest personal,work   # Search specific forests
memforest ask "question" --forest all             # Query all forests (results stay isolated)
```

### Euclid Gardening

```bash
memforest garden                             # Trigger a maintenance cycle
memforest garden --watch                     # Continuous gardening (daemon mode)
memforest garden --schedule "0 */6 * * *"    # Schedule regular maintenance
```

### Interactive Mode

```bash
memforest                              # Opens TUI — chat with Euclid
memforest tui                          # Explicit TUI launch
```

## Multi-Forest / Multi-Tenancy

Every forest is a tenant. Tenants are isolated at the data layer — separate markdown trees, separate SQLite databases, separate indexes. A forest never leaks data into another forest, even in error paths.

You can have as many forests as you need: one personal, one per team, one per project. Cross-forest queries require an explicit `--forest` flag, and results are always tagged by source, never merged.

```
~/.memforest/
├── config.toml
├── forests/
│   ├── personal/
│   │   ├── forest.toml
│   │   ├── mycelium.db
│   │   └── trees/
│   ├── work/
│   └── project-x/
```

Isolation is a security property, not a feature. It is designed in from day one, not bolted on later.

## Import from Obsidian

```bash
memforest import obsidian ~/my-vault
```

The importer scans your vault, parses frontmatter, resolves wiki-links into graph edges, generates local embeddings, builds all indexes, and runs a health check. What you keep: all markdown content, frontmatter, wiki-links as graph edges, folder structure as tree topology, tags, and aliases. What gets dropped: `.obsidian/` config, plugin data, CSS snippets, canvas files — app chrome, not knowledge.

## Agent Integration

Memforest ships as a SKILL installable in any agent harness. One command, and your agent knows how to use the forest instead of grepping files.

```bash
memforest install claude-code     # Writes .claude/skills/memforest.md
memforest install opencode        # Writes .opencode/skills/memforest.md
memforest install pi              # Writes SKILL.md
memforest install --format skill.md > SKILL.md   # Generic
```

After installation, agents use `memforest ask` and `memforest upsert` instead of raw file operations. They interact with the forest through Euclid, not through file paths.

## Euclid — The Gardener

Euclid is the autonomous agent that maintains and grows the forest. It is not a passive index — it is the brain of the system.

**What it does automatically:** links related notes, flags stale content, detects orphans, plants idea seeds as drafts, initiates research on gap topics, prunes dead drafts.

**What it asks before doing:** merging near-duplicate notes, pruning active content, modifying note content, any cross-forest operation.

Euclid runs as a maintenance cycle (`memforest garden`) or as a continuous daemon. It learns from usage patterns and evolves its gardening strategies over time.

## Contributing

See [CONSTITUTION.md](./CONSTITUTION.md) for code standards, architecture invariants, security properties, and contribution workflow. The constitution is designed so that a new contributor — human or agent — can submit a clean PR without prior context.

## License

MIT

---

*Memforest is pre-alpha software under active design. Everything described here is intent, not promise. The architecture and CLI surface may change as implementation reveals better paths.*
