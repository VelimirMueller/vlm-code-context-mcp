// Only show setup hint when installed as a dependency (inside node_modules)
if (!process.cwd().includes("node_modules")) process.exit(0);

console.log(`
  vlm-code-context-mcp installed!

  Next step:
    npx code-context-mcp setup        Initialize project (DB, MCP config, commands)
    npx code-context-dashboard .       Open dashboard at http://localhost:3333
`);
