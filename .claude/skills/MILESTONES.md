# Milestones

## Milestone 1: Production Foundation — COMPLETE
**Status:** Done (Sprints 1-4, 75pt)
**Goal:** Reliable MCP server with comprehensive test coverage, CI/CD, and documentation.
- 58 tests covering parser, schema, and scrum tools
- 10 code-context MCP tools
- GitHub Actions CI pipeline
- npm publish with provenance

## Milestone 2: Dashboard & Process Platform — COMPLETE
**Status:** Done (Sprints 5-10, 125pt)
**Goal:** Enterprise React dashboard with full sprint management capability.
- Vite + React 18 + TypeScript + Zustand + Framer Motion
- 51 React components in atomic design hierarchy
- Code Explorer with dependency graph and file tree
- Sprint Board with kanban, team grid, retro insights
- Project Management with milestones, vision editor, gantt, planning insights
- 25 scrum MCP tools for full sprint lifecycle
- Framer Motion page transitions, hero animations, landing sequence

## Milestone 3: Bootstrap & Persistence — COMPLETE
**Status:** Done (Sprint 11, 19pt)
**Goal:** Enable new users to set up via npm with full agent team and data persistence.
- Enhanced CLI: --help, --force, --name, setup subcommand
- .claude/ scaffolding with 19 template files (9 agents, 3 skills, 7 scrum defaults)
- Database dump/restore MCP tools
- Onboarding wizard (get_onboarding_status, run_onboarding)
- Dashboard API for dump/restore
- Frontend deps moved to devDependencies

## Milestone 4: Ecosystem Growth — PLANNED
**Status:** Planned
**Goal:** Multi-language support, VS Code extension, plugin system.
- Tree-sitter parsing for Python, Go, Rust
- VS Code extension with inline MCP tool access
- Incremental re-indexing (watch mode)
- Semantic search across codebase
- Plugin system for custom MCP tools
