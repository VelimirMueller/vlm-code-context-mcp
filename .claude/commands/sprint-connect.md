# Sprint Connect — Bridge UI to Claude Session

Connect the dashboard UI to this Claude session. Spawns a background agent that polls for dashboard actions and executes them using MCP tools. Re-spawns automatically when the agent times out.

## How It Works

1. Spawn a background agent that polls `pending_actions` in context.db every second
2. When an action arrives (button click in UI), the agent executes the corresponding MCP tool
3. The main session gets notified of completed actions
4. If the agent exits (timeout), re-spawn it automatically
5. Continue until the user says "quit" or "disconnect"

## Instructions

When the user runs `/sprint-connect`, execute this loop:

### Step 1: Announce connection

Tell the user:
```
Sprint Connect active. Dashboard actions will be handled automatically.
Open http://localhost:3333 (or whichever port) to use the UI.
Say "disconnect" to stop listening.
```

### Step 2: Spawn the polling agent

Spawn a background agent with this prompt:

```
You are a bridge agent polling for dashboard actions in the MCP server project.

Your job:
1. Read the pending_actions table from context.db using a bash command every second
2. When you find a pending action, claim it and execute the corresponding MCP tool
3. After executing, mark the action as completed in the database
4. Report what you did back to the main session
5. Continue polling until 3 minutes have passed with no actions, then exit

Polling command (run this in a loop):
node -e '
const Database = require("better-sqlite3");
const db = new Database("context.db");
const rows = db.prepare("SELECT id, action, entity_type, entity_id, payload, status FROM pending_actions WHERE status = ? ORDER BY created_at ASC LIMIT 1").all("pending");
if (rows.length > 0) {
  const r = rows[0];
  db.prepare("UPDATE pending_actions SET status = '\''claimed'\'', claimed_at = datetime('\''now'\'') WHERE id = ?").run(r.id);
  console.log(JSON.stringify(r));
} else {
  console.log("NONE");
}
db.close();
'

Action mapping — when you find an action, call the MCP tool:
- advance_sprint → call advance_sprint({ sprint_id: <entity_id> })
- update_ticket → call update_ticket({ ticket_id: <entity_id>, ...JSON.parse(payload) })
- create_ticket → call create_ticket({ ...JSON.parse(payload) })
- run_kickoff → call handle_run_kickoff() if available, otherwise report "kickoff requested"
- implement_ticket → Read the ticket details with get_ticket({ ticket_id: <entity_id> }), then actually implement it: read relevant files, write code, run tests, and mark the ticket DONE when finished

After executing, mark completed:
node -e '
const Database = require("better-sqlite3");
const db = new Database("context.db");
db.prepare("UPDATE pending_actions SET status = '\''completed'\'', completed_at = datetime('\''now'\'') WHERE id = ?").run(<ACTION_ID>);
db.close();
'

IMPORTANT: After each action, report back what you did. Keep polling until 3 minutes of no activity.
```

### Step 3: Monitor and re-spawn

When the background agent finishes (timeout or completion):
1. Check if the user said "disconnect" — if so, stop
2. Otherwise, tell the user: "Listener timed out after 3 min idle. Re-spawning..."
3. Go back to Step 2

### Step 4: Handle disconnect

When the user says "disconnect", "quit", or "stop":
1. Let any running background agent finish its current action
2. Say: "Sprint Connect disconnected. Dashboard buttons will use direct API only."
