# Milestones

---

## Milestone 1: Rock Solid Foundation

**Goal:** Make the existing 10-tool feature set production-grade. No senior engineer should hit a bug, get a confusing error, or wonder how something works. The codebase should be something you'd point to as an example of how to build an MCP server.

**Timeline:** 2-3 sprints (3-5 weeks)

**Success Criteria:**
- 90%+ test coverage across indexer, server tools, schema, and dashboard
- Zero unhandled exceptions -- every tool returns meaningful error messages
- Indexing a 100K-line codebase completes in under 30 seconds
- Re-indexing (incremental) completes in under 5 seconds for codebases with <50 changed files
- README and inline docs pass the "new senior engineer can use it in 5 minutes" test
- CI pipeline runs tests, linting, and type checks on every PR
- npm package installs cleanly on macOS, Linux, and Windows (WSL)
- Dashboard loads in under 1 second for codebases with 1000+ files

**Key Deliverables:**
1. **Comprehensive test suite** -- Unit tests for every parser function (imports, exports, summaries, descriptions). Integration tests for full index-query cycles. Edge case coverage for malformed files, circular dependencies, symlinks, empty directories.
2. **Error handling hardening** -- Every tool gracefully handles missing files, corrupt databases, permission errors, out-of-memory on large codebases. No stack traces in MCP responses.
3. **Performance benchmarks** -- Automated benchmark suite that indexes real-world codebases (Express, Next.js, a 100K+ line monorepo) and tracks regression. Published numbers in README.
4. **Documentation overhaul** -- Architecture doc explaining the 5-table schema. Tool reference with examples for each of the 10 tools. "Why this tool?" section in README targeting senior engineers.
5. **CI/CD pipeline** -- GitHub Actions for test, lint, typecheck, build, publish. Automated npm releases on tagged commits.
6. **Edge case fixes** -- Handle re-exports (`export { x } from './y'`), barrel files, dynamic imports, TypeScript path aliases, monorepo workspace references.
7. **Cross-platform validation** -- Verified behavior on macOS, Ubuntu, Windows WSL. Path handling normalized.

---

## Milestone 2: Intelligence Layer

**Goal:** Transform from a metadata indexer into a tool that makes senior engineers say "I literally cannot work without this." Add features that demonstrate understanding of code, not just structure.

**Timeline:** 3-4 sprints (5-8 weeks)

**Success Criteria:**
- Agents using the intelligence features use 50%+ fewer tool calls to accomplish the same tasks compared to Milestone 1 baseline
- Incremental re-indexing detects and updates only changed files (no full re-scan)
- Cross-repo dependency queries work for monorepo setups with 5+ packages
- At least 3 community-contributed plugins exist in a plugin registry
- AI-generated descriptions are rated "useful" by 80%+ of test users (internal team)

**Key Deliverables:**
1. **Smart incremental indexing** -- Use file modification timestamps and content hashing to skip unchanged files. Re-index only what changed. Target: 10x faster re-index on large codebases.
2. **Real AST parsing** -- Replace regex-based export/import extraction with tree-sitter or TypeScript compiler API. Capture function signatures, parameter types, return types, JSDoc comments. Support for Python, Go, Rust ASTs via tree-sitter.
3. **Semantic search** -- Full-text search across file content, descriptions, and summaries. Ranked results with relevance scoring. "Find all files related to authentication" should work.
4. **Cross-repo analysis** -- For monorepos: resolve workspace package references, build cross-package dependency graphs. Know that `@myorg/auth` is used by `@myorg/api` and `@myorg/web`.
5. **AI-powered descriptions** -- Optional integration: send file summaries + export lists to an LLM to generate high-quality descriptions. Cache aggressively. Only re-generate when content changes.
6. **Plugin system** -- Expose hooks for custom analyzers. Let users add language-specific parsers, custom metadata extractors, or domain-specific enrichment. Ship with TypeScript and Python plugins built-in.
7. **Smart caching layer** -- SQLite query result caching with TTL. Frequently-queried files get priority in cache. Cache invalidation tied to file watcher events.
8. **Dependency impact analysis** -- "What breaks if I change this file?" Query that walks the dependency graph and returns all transitively-dependent files with their summaries.

---

## Milestone 3: Ecosystem Dominance

**Goal:** Become THE standard for how AI agents interact with codebases. Not just a tool you install -- the infrastructure layer that every serious AI-assisted development workflow depends on.

**Timeline:** 4-6 sprints (8-14 weeks)

**Success Criteria:**
- 5,000+ weekly npm downloads
- VS Code extension with 1,000+ installs
- Listed as recommended MCP server in at least 2 major AI coding tool docs
- Enterprise pilot with at least 1 team of 10+ engineers
- Multi-language deep analysis covers top 10 languages by usage (JS/TS, Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin)
- Public API for third-party integrations

**Key Deliverables:**
1. **Multi-language deep analysis** -- Tree-sitter grammars for top 10 languages. Full export/import resolution, type extraction, and dependency graphs for each. Not just "we index it" -- "we understand it."
2. **VS Code extension** -- Sidebar showing indexed codebase structure. Click-to-navigate dependency graph. Inline descriptions from the index. "Explain this file's role" command powered by the MCP data.
3. **JetBrains plugin** -- Same features as VS Code extension for WebStorm/IntelliJ users.
4. **Team collaboration** -- Shared SQLite indexes (via git-tracked db or remote sync). Description workflows: engineers annotate files, annotations propagate to all team members' agents.
5. **Enterprise features** -- Access control (which files/directories agents can query). Audit trail (which agent queried what, when). SSO integration for team features. On-prem deployment guide.
6. **Multi-repo orchestration** -- Index multiple repositories into a single queryable database. Cross-repo dependency graphs. "Which repos depend on this shared library?"
7. **Real-time streaming index** -- File watcher that updates the index in real-time as files change. No manual re-index needed. Agents always query fresh data.
8. **Public API and SDK** -- REST API for querying indexes remotely. TypeScript SDK for building custom tools on top of the index. GraphQL endpoint for flexible queries.
9. **Performance at scale** -- Handle 1M+ line codebases. Sharded SQLite for massive repos. Parallel indexing. Benchmark against 10 real-world open-source projects and publish results.
10. **Community ecosystem** -- Plugin marketplace. Contributor docs. Monthly release cadence. Discord/community for users building on top of the platform.
