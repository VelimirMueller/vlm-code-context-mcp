# Product Vision: vlm-code-context-mcp

## The Problem

AI agents are stupid about codebases. Every time an agent needs to understand a file, it reads the entire thing -- 200, 500, 2000 lines of raw source -- burning context window on syntax it doesn't need. Multiply that across a real codebase (500+ files, cross-cutting dependencies, nested modules) and you're hemorrhaging tokens on file I/O instead of actual reasoning.

The math is brutal: a senior engineer asks Claude to refactor a service layer. The agent reads 15 files to understand the dependency graph. That's ~30K tokens of raw source just to answer "what depends on what?" -- information that could be expressed in 4K tokens of structured metadata.

This is not a convenience problem. It's a fundamental architectural flaw in how AI agents interact with code.

## The Solution

Pre-index the codebase into SQLite. Let agents query structured metadata instead of reading raw files.

One `index_directory` call builds a complete map: every file's summary, exports, imports, dependency graph, external packages, directory structure, and change history. All queryable via SQL or purpose-built MCP tools.

**3x fewer context tokens.** An agent gets a file's purpose, its exports, what it imports, and what imports it -- without reading a single line of source.

**8x less data transfer.** Structured metadata vs. raw file content. The agent knows what `indexer.ts` does, what it exports, and how it connects to `schema.ts` and `index.ts` before deciding whether to read the actual code.

**Dependency graphs for free.** `find_symbol("parseImports")` tells you exactly which file exports it and what that file does. No grep. No file-by-file scanning.

**Change awareness.** The agent sees what changed, when, and why -- diffs, line count deltas, export changes -- without running git log and parsing output.

## Who This Is For

- **Senior engineers using AI agents daily.** You're already using Claude, Copilot, or custom agents to navigate and modify large codebases. You've felt the pain of agents wasting half their context on file reads.
- **Teams with 50K+ line codebases.** The bigger the codebase, the more this matters. At scale, unstructured file reads are the bottleneck, not model intelligence.
- **AI-first development workflows.** If you're building systems where agents autonomously explore, modify, and reason about code, this is infrastructure you need.

## What Makes It Killer

1. **Zero-config indexing.** Point it at a directory. It handles 50+ languages, extracts exports/imports/summaries, builds dependency graphs, generates descriptions, and tracks changes. No config files. No AST plugins. It works on install.
2. **SQL escape hatch.** Every tool is a convenience wrapper around SQLite. When the built-in tools aren't enough, agents can run arbitrary SELECT queries against the full schema. Power users (and power agents) are never blocked.
3. **Change tracking with diffs.** Every re-index captures what changed -- line counts, file sizes, export mutations, inline diffs. Agents can reason about code evolution without touching git.
4. **Human-in-the-loop descriptions.** Auto-generated descriptions are a starting point. Engineers can set manual descriptions that persist across re-indexes. The metadata gets better the more you use it.
5. **Live dashboard.** Port 3333 gives you a real-time view of your indexed codebase -- files, exports, dependencies, changes -- with live reload via chokidar.

## Where This Is Going

**Near term:** Bulletproof the foundation. Comprehensive test suite, performance benchmarks on 100K+ line codebases, hardened error handling, CI/CD pipeline.

**Mid term:** Intelligence layer. Semantic code understanding (not just regex parsing), cross-repo dependency analysis, AI-powered description generation, smart incremental indexing, plugin system for custom analyzers.

**Long term:** Become the standard interface between AI agents and codebases. Multi-language deep analysis (real ASTs, not regex), IDE integrations (VS Code, JetBrains), team collaboration (shared indexes, description workflows), enterprise features (access control, audit trails, multi-repo orchestration).

The endgame: no AI agent reads a raw file without checking the index first. `vlm-code-context-mcp` becomes the filesystem abstraction layer for AI-assisted development.
