# Milestones

---

## Milestone 1: Production Foundation — COMPLETE

**Status:** Done (Sprints 1-4)

**Goal:** Establish a reliable, well-tested MCP server with comprehensive error handling, CI/CD, and documentation that experienced engineers can evaluate and adopt quickly.

**Delivered:**
- 58 tests covering parser, schema, scrum tools, and error paths
- Error handling on all MCP tool handlers — no stack traces in responses
- CI/CD pipeline (GitHub Actions, Node 18/20/22 matrix, npm publish with provenance)
- Documentation: README with schema reference, 27-tool reference, architecture overview
- Import/export parser covering named, default, namespace, re-export, and async patterns

---

## Milestone 2: Dashboard & Process Platform — IN PROGRESS

**Status:** Active (Sprints 5-7+)

**Goal:** Evolve the dashboard from a code explorer into a full project management interface. Add sprint management views, team visibility, and project planning tools that integrate with the MCP scrum service.

**Timeline:** 3-4 sprints

**Success Criteria:**
- Dashboard serves as a self-contained project management view alongside code exploration
- Sprint tickets visible as a kanban board with status columns
- Project milestones displayed as a visual timeline
- Agent team health and workload visible at a glance
- Landing page communicates the product scope clearly to new users

**Key Deliverables:**
1. **Kanban board** — Sprint tickets displayed as cards in TODO/IN_PROGRESS/DONE/BLOCKED columns with point totals per column
2. **Project Planning view** — Milestones as a horizontal timeline (Gantt-style bars), product vision, sprint roadmap
3. **Team mood and workload** — Agent cards with computed mood scores based on ticket load, blocked work, and completed output
4. **Enterprise landing page** — Sequenced animation showing the product capabilities before entering the dashboard
5. **Scrum MCP write tools** — Full CRUD for sprints, tickets, retro findings, blockers, bugs via MCP protocol
6. **Mobile-responsive layout** — All views functional on screens down to 375px width

---

## Milestone 3: Ecosystem Growth

**Goal:** Expand language support, add IDE integrations, and build features that support team adoption across larger engineering organizations.

**Timeline:** 4-6 sprints (estimated)

**Success Criteria:**
- Multi-language parsing beyond JS/TS (Python, Go, Rust via tree-sitter)
- VS Code extension with sidebar navigation and inline descriptions
- Incremental re-indexing (content hashing, skip unchanged files)
- Semantic search across file content and descriptions
- Plugin system for custom analyzers and language-specific parsers

**Key Deliverables:**
1. **Tree-sitter integration** — AST-based parsing for top 5 languages, replacing regex where possible
2. **VS Code extension** — Sidebar showing indexed structure, click-to-navigate dependency graph
3. **Smart incremental indexing** — File modification timestamps + content hashing, 10x faster re-index
4. **Semantic search** — Full-text search with relevance scoring across all indexed metadata
5. **Cross-repo analysis** — Monorepo workspace resolution, cross-package dependency graphs
6. **Plugin hooks** — Extension points for custom parsers, metadata extractors, and enrichment
7. **Dependency impact analysis** — "What breaks if I change this file?" transitive dependency query
8. **Public API** — REST/GraphQL endpoints for querying indexes remotely, TypeScript SDK
