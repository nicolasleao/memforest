# Memforest Constitution

## 1. Preamble

This document defines the non-negotiable rules of the memforest project. It governs all contributors — human and AI agent alike. Every pull request, every commit, every line of code is subject to these rules. If a contribution violates the constitution, it is rejected regardless of who or what authored it.

The constitution can only be amended through a deliberate process: a human maintainer proposes a change, the change is discussed in a public issue or PR, and at least one other human maintainer approves. No AI agent may modify this document without human approval.

---

## 2. Architecture Invariants

These rules are structural load-bearing walls. Removing or weakening any of them compromises the entire system.

**2.1 Multi-tenancy isolation is absolute.**
Tenant data never leaks to another tenant. Not in query results, not in error messages, not in logs, not in stack traces, not in cached state. Every code path that touches tenant data must be provably scoped. There is no "admin mode" that bypasses isolation.

**2.2 Domain boundaries are enforced by import rules.**
The source tree has six domains: `forest/`, `mycelium/`, `euclid/`, `import/`, `skill/`, `shared/`. No domain may import from another domain's internals. Cross-domain communication flows exclusively through `shared/` types or explicit public interfaces exported at domain boundaries. A direct import from `src/forest/` into `src/mycelium/` (or any other cross-domain path) is a constitutional violation.

**2.3 Layering is strictly directional.**
The dependency direction is: CLI -> Euclid -> Mycelium -> Forest. Upper layers depend on lower layers. Lower layers never import from upper layers. `shared/` is available to all layers but depends on none of them.

```
CLI (top — entry point, user interaction)
  |
Euclid (agent runtime, pipelines, orchestration)
  |
Mycelium (search, indexing, graph, embeddings)
  |
Forest (bottom — tenant management, file I/O, tree topology)
```

**2.4 Markdown is the source of truth.**
The database (SQLite or PostgreSQL) is a derived index. If the database is deleted, it can be rebuilt from the markdown files. If a markdown file contradicts the database, the markdown file wins. No write path may update the database without also updating (or creating) the corresponding markdown file, unless the operation is purely index-level (FTS rebuild, embedding regeneration, graph recomputation).

**2.5 Tenant resolution happens once, at the boundary.**
The CLI layer resolves which tenant/forest is active. It passes a tenant context (ID, paths, configuration) into the layers below. Inner layers (Mycelium, Forest) never re-resolve the tenant. They receive it as an explicit parameter. If a function in an inner layer needs to know the tenant, it receives it as an argument — it never reads global state or re-parses configuration to figure it out.

---

## 3. Code Standards

**3.1 TypeScript strict mode. No exceptions.**
`strict: true` in `tsconfig.json`. No `any` type unless accompanied by a comment explaining why it is unavoidable and what the actual expected type is. Every `any` is tech debt with an expiration date — the comment must describe when and how it should be removed.

**3.2 No comments by default.**
Code should be self-documenting through naming and structure. Add a comment only when the *why* is non-obvious — when the code is correct but surprising, when a workaround exists for a specific bug, when a performance choice is counterintuitive. Never comment *what* the code does.

**3.3 Naming is descriptive and unabbreviated.**
Function and variable names use full words. Exceptions: universally understood abbreviations (DB, FTS, ID, URL, HTTP, API, CLI, TUI, PR, CI). Domain-specific abbreviations must be defined in the domain's README or types file. `cfg` is not acceptable; `config` is. `res` is not acceptable; `response` is.

**3.4 No premature abstraction.**
Three similar lines of code are better than a premature helper function. Extract only when you have three or more call sites with identical logic, or when the abstraction makes the code genuinely clearer. "I might need this later" is not a justification.

**3.5 Testing requirements.**
- Domain logic (pure functions, transformations, validations): unit tests. Use vitest.
- Cross-domain flows (import pipeline, search across forest + mycelium): integration tests.
- Database interactions: integration tests with real SQLite. No mocking the database. SQLite is fast enough and in-memory mode exists — there is no reason to mock it.
- Every bug fix includes a regression test that fails without the fix and passes with it.

**3.6 Biome for formatting and linting.**
Biome is the single source of truth for code style. No ESLint. No Prettier. No overrides to biome configuration without a documented justification in the PR that introduces them. Run `biome check` before every commit.

**3.7 No dead code.**
No commented-out code in main. No unused imports. No unreachable branches. If code is not needed now, delete it — git remembers.

---

## 4. Security Properties

**4.1 Tenant isolation is the #1 security invariant.**
Every other security property is secondary to this. A cross-tenant data leak is a critical severity incident. Code reviews must verify tenant scoping on every data access path.

**4.2 Import sanitization.**
All ingested markdown (Obsidian import, generic import, agent-created content) is treated as untrusted input. Frontmatter is parsed and validated against a known schema — unexpected fields are preserved but never executed. Markdown content is never evaluated, interpolated, or passed to `eval`-like constructs. File paths from imports are sanitized to prevent directory traversal.

**4.3 No secrets in content.**
Markdown files, frontmatter fields, and database records must never contain secrets (API keys, tokens, passwords, private keys). If a secret is detected during import or upsert, the operation should warn and the field should be redacted or rejected. Secrets belong in environment variables or a dedicated secrets manager, never in the forest.

**4.4 Embedding vectors are tenant-scoped.**
Embedding vectors are stored per-tenant and never shared across tenants. Cross-forest search returns results tagged by source forest — embedding similarity scores are computed within a single tenant's vector space, never across tenants. A vector from tenant A must never appear in a query result for tenant B.

**4.5 SQLite isolation (v0).**
Each tenant's SQLite database is a separate file at a tenant-specific path. File system permissions enforce isolation. The application never opens two tenant databases in the same connection. No `ATTACH DATABASE` across tenants.

**4.6 PostgreSQL isolation (v1).**
Each tenant has a dedicated schema. Every query sets `search_path` to the target tenant's schema before execution. The default `search_path` is never trusted. Connection pooling must ensure that a connection returned to the pool has its `search_path` reset. A query that runs against the wrong schema is a critical severity bug.

---

## 5. Domain Boundaries

Each domain owns its types, services, and internal structure. The following defines each domain's responsibility and what it must not do.

### `src/forest/`
**Owns**: Tenant lifecycle (create, list, delete, archive), markdown file I/O, tree topology (directory structure, branch naming), frontmatter schema.
**Must not**: Perform search. Generate embeddings. Run agent logic. Import from external formats.

### `src/mycelium/`
**Owns**: FTS indexing, vector embeddings, graph storage and traversal, hybrid search, freshness tracking, cross-forest query routing.
**Must not**: Manage tenant lifecycle. Write markdown files directly (it writes to the DB index). Run agent pipelines. Know about import formats.

### `src/euclid/`
**Owns**: Agent runtime, gardening pipelines (plant, research, prune, merge, link), maintenance scheduling, autonomy boundary enforcement, self-evolution.
**Must not**: Directly access the database (goes through mycelium). Directly write files (goes through forest). Skip autonomy boundary checks. Import external formats.

### `src/import/`
**Owns**: Obsidian vault import, generic markdown folder import, link resolution, format conversion, conflict handling.
**Must not**: Define storage formats. Own the indexing pipeline. Make agent decisions. Modify existing forest content (import is additive).

### `src/skill/`
**Owns**: SKILL.md template generation, agent harness detection, adapter formatting for Claude Code / OpenCode / Pi / generic.
**Must not**: Contain business logic. Access the database. Modify the forest. Run agent pipelines.

### `src/shared/`
**Owns**: Cross-cutting types (TenantContext, ForestConfig, etc.), configuration loading, structured logging, error types, tenant resolution logic (used by CLI layer).
**Must not**: Contain domain logic. Import from any domain. Grow into a dumping ground — every type in shared must be used by at least two domains, or it belongs in the domain that uses it.

### Cross-Domain Rules

- Domains communicate through types defined in `shared/` or through explicit public interfaces.
- A domain's internal modules (files not re-exported from the domain's index) are private. Importing a domain's internal module is a constitutional violation equivalent to importing a private field.
- When a new cross-domain type is needed, it goes in `shared/`. When an existing `shared/` type is only used by one domain, it moves to that domain.

---

## 6. Contribution Workflow

**6.1 Process: Fork, Branch, PR, Review, Merge.**
All changes enter through pull requests. No direct commits to `main`. Branch names should be descriptive: `feat/obsidian-import`, `fix/tenant-leak-in-search`, `refactor/mycelium-graph-types`.

**6.2 PR requirements.**
Every PR must include:
- **What changed**: a concise description of the modifications.
- **Why**: the motivation — bug report, feature requirement, tech debt reduction.
- **Which domain(s) affected**: list every domain directory touched.
- **Test plan**: what tests were added or modified, how to verify the change works.

**6.3 CI is mandatory.**
All PRs run the full CI pipeline: `biome check`, `tsc --noEmit`, `vitest run`. A PR with failing CI is not reviewed until CI passes.

**6.4 Breaking changes require an ADR.**
Any change that modifies a domain's public interface, alters the database schema, changes the CLI command surface, or modifies tenant isolation behavior requires an Architecture Decision Record in `docs/adr/`. The ADR must document: the decision, the alternatives considered, the rationale, and the migration path.

**6.5 One concern per PR.**
A PR that fixes a bug AND refactors a module AND adds a feature is three PRs. Keep changes atomic and reviewable.

---

## 7. Agent Contributor Guidelines

AI agents are first-class contributors to memforest. They are held to the same standards as human contributors — plus additional constraints that reflect their nature.

**7.1 Same standards, no exceptions.**
Agents must produce code that passes CI, respects domain boundaries, includes tests, and follows the code standards in section 3. "An agent wrote it" is not a justification for lower quality.

**7.2 Read before you write.**
Before contributing, agents MUST read `CONSTITUTION.md` (this document) and `BRIEF.md`. These two documents contain the complete context needed to contribute correctly.

**7.3 Respect domain boundaries.**
Agents must not reach across domain boundaries. If a task requires modifying two domains, the agent modifies each domain's public interface and shared types — never one domain's internals from another domain's code.

**7.4 Run tests before submitting.**
Agents must execute `biome check`, `tsc --noEmit`, and `vitest run` and confirm all pass before submitting a PR or proposing a commit. Untested agent contributions are rejected.

**7.5 Document non-obvious decisions.**
When an agent makes a judgment call (choosing between two valid approaches, working around a limitation, interpreting ambiguous requirements), it must document the decision in the commit message or PR description. "I chose X because Y" — one sentence is enough.

**7.6 Protected files.**
Agents MUST NOT modify `CONSTITUTION.md`, `BRIEF.md`, or `LICENSE` without explicit human approval. These files define the project's identity and governance. An agent PR that modifies a protected file without prior human authorization is rejected unconditionally.

**7.7 Never weaken tenant isolation.**
No agent contribution may weaken, bypass, or work around tenant isolation guarantees. If a feature seems to require crossing tenant boundaries, the agent must flag it for human review rather than implementing a shortcut.

**7.8 Commit attribution.**
Agent-authored commits must include a `Co-Authored-By` trailer identifying the agent system. Contributions must be transparent about their origin.

---

## 8. Euclid-Specific Rules

Euclid is not just a contributor — it is an autonomous agent embedded in the system. Its autonomy is bounded by this constitution.

**8.1 Autonomy boundaries are constitutional.**
The autonomy levels defined in `BRIEF.md` (Auto vs. Confirm) are constitutional constraints, not configuration. Changing an action's autonomy level from Confirm to Auto requires a human-approved amendment to both `BRIEF.md` and this document.

**8.2 All autonomous actions are logged.**
Every action Euclid takes autonomously (adding links, updating metadata, flagging stale notes, planting seeds, pruning drafts) must produce a structured log entry with: timestamp, action type, affected branch/tree, tenant context, and rationale. "Euclid did something" is never acceptable — the log must answer what, where, why, and when.

**8.3 Euclid never crosses tenant boundaries without confirmation.**
Cross-forest operations always require explicit user confirmation, regardless of the action's base autonomy level. Euclid may observe that a link *could* connect forests, but it must not create that link without human approval. Tenant isolation supersedes gardening convenience.

**8.4 Self-evolution is bounded.**
Euclid can evolve its gardening strategies (reorder priorities, adjust thresholds, learn from usage patterns). Evolved skills and strategies must pass the same test suite as human-written code. Euclid cannot grant itself new autonomy levels, modify its own autonomy boundaries, or bypass the Confirm requirement on destructive operations. Evolution improves *how* Euclid works within its boundaries — it does not expand the boundaries.

**8.5 Destructive operations require confirmation.**
Pruning active notes, merging notes, modifying non-metadata content, and deleting any non-draft content always require explicit user confirmation. This cannot be overridden by configuration, evolved behavior, or agent reasoning. The user's content is sovereign.

**8.6 Euclid operates within one tenant at a time.**
Euclid's gardening context is always a single forest. It receives a tenant context at invocation and operates exclusively within that scope. Cross-forest awareness (e.g., detecting related content across forests) is read-only observation, never write action, and always requires confirmation before surfacing results.

---

## Amendments

This constitution is a living document, but it changes slowly and deliberately. Amendments follow this process:

1. A human maintainer opens a PR modifying `CONSTITUTION.md`.
2. The PR describes what is changing, why, and what the impact is.
3. At least one other human maintainer reviews and approves.
4. The amendment is merged and takes effect immediately.

No AI agent may initiate a constitutional amendment. Agents may *suggest* amendments by opening an issue describing the proposed change and its rationale, but the PR must be authored or explicitly approved by a human maintainer.

---

*This constitution exists because memforest is infrastructure that agents depend on. Unstable infrastructure produces unreliable agents. These rules keep the foundation solid so everything built on top of it can be trusted.*
