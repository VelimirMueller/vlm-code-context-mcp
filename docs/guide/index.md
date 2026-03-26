# Getting Started

## Project Overview

The Code Context MCP server indexes **23 files** totaling **7,180 lines** across **4 languages** (TypeScript, HTML, Markdown, JSON). Here is the directory breakdown:

| Directory | Description |
|-----------|-------------|
| `src/` | TypeScript source code — server, dashboard, and database modules (7 files, 2,430 lines, 111KB) |
| `src/server/` | Core MCP server logic — tool definitions, database schema, file indexer, and setup script (4 files, 1,013 lines, 42KB) |
| `src/dashboard/` | Web dashboard — HTTP server, API endpoints, and the single-page explorer UI (2 files, 1,391 lines, 69KB) |
| `src/database/` | Standalone database utilities for testing and prototyping (1 file, 26 lines) |
| `docs/` | VitePress documentation site — guides, tool references, and architecture docs (12 files) |
| `docs/guide/` | Getting started guide and architecture overview (2 files) |
| `docs/tools/` | Reference pages for each MCP tool — parameters, examples, and usage (7 files) |

## Installation

```bash
npm install
npm run build
```

## Setup

Point the setup script at your project directory:

```bash
npm run setup -- /path/to/your/project
```

This will:
1. Create and initialize the SQLite database
2. Index all files in the target directory
3. Write a `.mcp.json` config for your AI client

## Running the MCP Server

The server starts automatically when your AI client reads `.mcp.json`. You can also start it manually:

```bash
npm start -- ./context.db
```

## Dashboard

View the indexed data in a browser:

```bash
npm run dashboard
```

Open [http://localhost:3333](http://localhost:3333). Pass a watch directory to auto-reindex on file changes:

```bash
npm run dashboard -- ./context.db 3333 /path/to/your/project
```
