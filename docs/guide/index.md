# Getting Started

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
