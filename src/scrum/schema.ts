import type Database from "better-sqlite3";

/**
 * Initialize the SQLite schema for the Scrum system.
 * Tables: agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes, milestones, decisions
 */
export function initScrumSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      model TEXT,
      tools TEXT,
      system_prompt TEXT,
      department TEXT DEFAULT 'development',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      goal TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest', 'done')),
      velocity_committed INTEGER DEFAULT 0,
      velocity_completed INTEGER DEFAULT 0,
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id INTEGER,
      ticket_ref TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
      status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'PARTIAL', 'NOT_DONE')),
      assigned_to TEXT,
      story_points INTEGER,
      milestone TEXT,
      milestone_id INTEGER,
      qa_verified INTEGER NOT NULL DEFAULT 0,
      verified_by TEXT,
      acceptance_criteria TEXT,
      dependencies TEXT,
      notes TEXT,
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
      UNIQUE(sprint_id, ticket_ref)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      assigned_to TEXT,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS retro_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id INTEGER NOT NULL,
      role TEXT,
      category TEXT NOT NULL CHECK (category IN ('went_well', 'went_wrong', 'try_next', 'auto_analysis')),
      finding TEXT NOT NULL,
      action_owner TEXT,
      action_applied INTEGER NOT NULL DEFAULT 0,
      linked_ticket_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id INTEGER NOT NULL,
      ticket_id INTEGER,
      description TEXT NOT NULL,
      reported_by TEXT,
      escalated_to TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id INTEGER NOT NULL,
      ticket_id INTEGER,
      severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
      description TEXT NOT NULL,
      steps_to_reproduce TEXT,
      expected TEXT,
      actual TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'deferred')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT,
      owner_role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
      target_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      rationale TEXT,
      alternatives TEXT,
      outcome TEXT,
      category TEXT DEFAULT 'technical',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
      milestone_id INTEGER REFERENCES milestones(id),
      color TEXT DEFAULT '#3b82f6',
      priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
      deleted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprint_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sprint_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      remaining_points INTEGER NOT NULL DEFAULT 0,
      completed_points INTEGER NOT NULL DEFAULT 0,
      added_points INTEGER NOT NULL DEFAULT 0,
      removed_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      UNIQUE(sprint_id, date)
    );

    CREATE TABLE IF NOT EXISTS ticket_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_ticket_id INTEGER NOT NULL,
      target_ticket_id INTEGER NOT NULL,
      dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'blocked_by', 'related')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      UNIQUE(source_ticket_id, target_ticket_id, dependency_type)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_tags (
      ticket_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ticket_id, tag_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_mood_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      sprint_id INTEGER NOT NULL,
      mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
      workload_points INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      UNIQUE(agent_id, sprint_id)
    );

    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('ticket', 'sprint', 'epic', 'milestone', 'agent', 'blocker', 'bug', 'discovery')),
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
    CREATE INDEX IF NOT EXISTS idx_epics_status ON epics(status);
    CREATE INDEX IF NOT EXISTS idx_epics_milestone ON epics(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_sprint_id ON tickets(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_subtasks_ticket_id ON subtasks(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_retro_findings_sprint_id ON retro_findings(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_blockers_sprint_id ON blockers(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_bugs_sprint_id ON bugs(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
    CREATE INDEX IF NOT EXISTS idx_sprint_metrics_sprint ON sprint_metrics(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_deps_source ON ticket_dependencies(source_ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_deps_target ON ticket_dependencies(target_ticket_id);
    CREATE INDEX IF NOT EXISTS idx_mood_history_agent ON agent_mood_history(agent_id);
    CREATE INDEX IF NOT EXISTS idx_mood_history_sprint ON agent_mood_history(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_event_log_entity ON event_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_sprint_deleted ON tickets(sprint_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_sprints_status_deleted ON sprints(status, deleted_at);

    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      sprint_id INTEGER,
      ticket_id INTEGER,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      tool_calls INTEGER NOT NULL DEFAULT 0,
      duration_sec INTEGER,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    );
  `);

  // Migrate existing databases: add milestone_id column if missing
  const cols = db.pragma("table_info(tickets)") as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "milestone_id")) {
    db.exec(
      "ALTER TABLE tickets ADD COLUMN milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL",
    );
  }

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_tickets_milestone_id ON tickets(milestone_id);",
  );

  // Migrate: add epic_id to tickets if missing
  if (!cols.some((c) => c.name === "epic_id")) {
    db.exec("ALTER TABLE tickets ADD COLUMN epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_tickets_epic_id ON tickets(epic_id);");

  // Migrate: add milestone_id to sprints if missing
  const sprintCols = db.pragma("table_info(sprints)") as Array<{ name: string }>;
  if (!sprintCols.some((c) => c.name === "milestone_id")) {
    db.exec("ALTER TABLE sprints ADD COLUMN milestone_id INTEGER REFERENCES milestones(id)");
  }

  // Schema version tracking table
  db.exec(`CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

export function runMigrations(db: Database.Database): void {
  const current = (db.prepare("SELECT MAX(version) as v FROM schema_versions").get() as any)?.v ?? 0;
  const migrations = [
    { version: 1, name: 'add_epic_id_to_tickets', sql: "SELECT 1" }, // already done
    { version: 2, name: 'add_milestone_id_to_sprints', sql: "SELECT 1" }, // already done
    { version: 3, name: 'add_decisions_table', sql: "SELECT 1" }, // already done
    { version: 4, name: 'sprint_phases_v2', sql: "SELECT 1" }, // already done
    { version: 5, name: 'sprint_10_phases', sql: `
      CREATE TABLE IF NOT EXISTS sprints_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        goal TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'preparation' CHECK (status IN ('preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest')),
        velocity_committed INTEGER DEFAULT 0,
        velocity_completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        milestone_id INTEGER REFERENCES milestones(id)
      );
      INSERT OR IGNORE INTO sprints_new SELECT id, name, goal, start_date, end_date, status, velocity_committed, velocity_completed, created_at, updated_at, milestone_id FROM sprints;
      DROP TABLE sprints;
      ALTER TABLE sprints_new RENAME TO sprints;
      CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
    ` },
    { version: 6, name: 'add_time_tracking_to_tickets', sql: `
      ALTER TABLE tickets ADD COLUMN estimated_hours REAL;
      ALTER TABLE tickets ADD COLUMN actual_hours REAL;
    ` },
    { version: 7, name: 'add_review_status_to_tickets', sql: `
      SELECT 1
    ` }, // review_status already exists from earlier migration
    { version: 8, name: 'seed_default_tags', sql: `
      INSERT OR IGNORE INTO tags (name, color) VALUES ('tech-debt', '#ef4444');
      INSERT OR IGNORE INTO tags (name, color) VALUES ('security', '#f59e0b');
      INSERT OR IGNORE INTO tags (name, color) VALUES ('ux', '#8b5cf6');
      INSERT OR IGNORE INTO tags (name, color) VALUES ('bug', '#dc2626');
      INSERT OR IGNORE INTO tags (name, color) VALUES ('performance', '#10b981');
      INSERT OR IGNORE INTO tags (name, color) VALUES ('documentation', '#6366f1');
    ` },
    { version: 9, name: 'create_velocity_trends_view', sql: `
      CREATE VIEW IF NOT EXISTS velocity_trends AS
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        s.status,
        s.velocity_committed as committed,
        s.velocity_completed as completed,
        CASE WHEN s.velocity_committed > 0 THEN ROUND(CAST(s.velocity_completed AS REAL) / s.velocity_committed * 100, 1) ELSE 0 END as completion_rate,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as tickets_done,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as tickets_total,
        (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id) as bugs_found,
        (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id AND status = 'fixed') as bugs_fixed,
        s.start_date,
        s.end_date,
        s.created_at
      FROM sprints s
      WHERE s.deleted_at IS NULL
      ORDER BY s.created_at DESC;
    ` },
    { version: 10, name: 'create_linear_normalized_tables', sql: `SELECT 1` }, // tables created in initScrumSchema
    { version: 11, name: 'create_discoveries_table', sql: `
      CREATE TABLE IF NOT EXISTS discoveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discovery_sprint_id INTEGER NOT NULL REFERENCES sprints(id),
        finding TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('architecture', 'ux', 'performance', 'testing', 'integration', 'general')),
        status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'planned', 'implemented', 'dropped')),
        priority TEXT DEFAULT 'P1' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
        implementation_ticket_id INTEGER REFERENCES tickets(id),
        drop_reason TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_discoveries_sprint ON discoveries(discovery_sprint_id);
      CREATE INDEX IF NOT EXISTS idx_discoveries_status ON discoveries(status);
    ` },
    { version: 12, name: 'create_pending_actions_table', sql: `
      CREATE TABLE IF NOT EXISTS pending_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'expired')),
        source TEXT NOT NULL DEFAULT 'dashboard',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        claimed_at TEXT,
        completed_at TEXT,
        result TEXT,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status, created_at);
    ` },
    { version: 13, name: 'create_workflow_orchestration_tables', sql: `
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        steps TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'awaiting_agent', 'paused', 'completed', 'failed')),
        context TEXT,
        trigger_action_id INTEGER REFERENCES pending_actions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

      CREATE TABLE IF NOT EXISTS workflow_step_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL REFERENCES workflow_runs(id),
        step_index INTEGER NOT NULL,
        agent_role TEXT,
        action TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
        input TEXT,
        output TEXT,
        started_at TEXT,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_step_log_workflow ON workflow_step_log(workflow_id);
    ` },
    { version: 14, name: 'add_retro_linked_ticket_id', sql: `SELECT 1` },
    { version: 15, name: 'add_resolution_plan_to_discoveries', sql: `SELECT 1` },
    { version: 16, name: 'drop_linear_tables', sql: `
      DROP TABLE IF EXISTS linear_cache;
      DROP TABLE IF EXISTS linear_issues;
      DROP TABLE IF EXISTS linear_states;
      DROP TABLE IF EXISTS linear_labels;
    ` },
    { version: 17, name: 'simplify_sprint_phases_add_done', sql: `SELECT 1` },
    { version: 18, name: 'add_department_to_agents', sql: `
      UPDATE agents SET department = 'quality' WHERE role IN ('qa', 'security-specialist', 'scrum-master');
      UPDATE agents SET department = 'business' WHERE role IN ('product-owner', 'team-lead', 'manager', 'marketing-lead', 'growth-strategist', 'ux-designer');
    ` },
    { version: 19, name: 'add_ticket_composite_index', sql: `
      CREATE INDEX IF NOT EXISTS idx_tickets_sprint_deleted ON tickets(sprint_id, deleted_at);
    ` },
  ];

  // Wrap all migrations in a single transaction — partial failure rolls back cleanly
  const migrate = db.transaction(() => {
  // Safe column additions that migrations depend on (must run before versioned migrations)
  const agentCols = db.pragma("table_info(agents)") as Array<{ name: string }>;
  if (!agentCols.some((c) => c.name === "department")) {
    db.exec("ALTER TABLE agents ADD COLUMN department TEXT DEFAULT 'development'");
  }

  for (const m of migrations) {
    if (m.version > current) {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_versions (version, name) VALUES (?, ?)").run(m.version, m.name);
    }
  }

  // Safe column additions (idempotent — no-op if column already exists)
  const retroCols = db.pragma("table_info(retro_findings)") as Array<{ name: string }>;
  if (!retroCols.some((c) => c.name === "linked_ticket_id")) {
    db.exec("ALTER TABLE retro_findings ADD COLUMN linked_ticket_id INTEGER REFERENCES tickets(id)");
  }

  const discoveryCols = db.pragma("table_info(discoveries)") as Array<{ name: string }>;
  if (!discoveryCols.some((c) => c.name === "resolution_plan")) {
    db.exec("ALTER TABLE discoveries ADD COLUMN resolution_plan TEXT");
  }

  // Migration 17: Rebuild sprints table with 'done' in CHECK constraint (idempotent)
  // Check if the current sprints CHECK constraint already includes 'done'
  const sprintTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sprints'").get() as any)?.sql ?? "";
  if (!sprintTableSql.includes("'done'")) {
    const sprintCols = db.pragma("table_info(sprints)") as Array<{ name: string }>;
    const hasDeletedAt = sprintCols.some((c) => c.name === "deleted_at");
    const colList = hasDeletedAt
      ? "id, name, goal, start_date, end_date, status, velocity_committed, velocity_completed, created_at, updated_at, milestone_id, deleted_at"
      : "id, name, goal, start_date, end_date, status, velocity_committed, velocity_completed, created_at, updated_at, milestone_id";
    // Always include deleted_at in rebuilt table — migration 5 may have dropped it
    const deletedAtCol = ",\n        deleted_at TEXT DEFAULT NULL";
    db.exec(`
      CREATE TABLE IF NOT EXISTS sprints_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        goal TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest', 'done')),
        velocity_committed INTEGER DEFAULT 0,
        velocity_completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        milestone_id INTEGER REFERENCES milestones(id)${deletedAtCol}
      );
    `);
    // If source has deleted_at, copy it; otherwise let it default to NULL
    if (hasDeletedAt) {
      db.exec(`INSERT OR IGNORE INTO sprints_v3 (${colList}) SELECT ${colList} FROM sprints;`);
    } else {
      db.exec(`INSERT OR IGNORE INTO sprints_v3 (id, name, goal, start_date, end_date, status, velocity_committed, velocity_completed, created_at, updated_at, milestone_id) SELECT id, name, goal, start_date, end_date, status, velocity_committed, velocity_completed, created_at, updated_at, milestone_id FROM sprints;`);
    }
    db.exec(`DROP VIEW IF EXISTS velocity_trends;`);
    db.exec(`DROP TABLE sprints;`);
    db.exec(`ALTER TABLE sprints_v3 RENAME TO sprints;`);
    // Recreate velocity_trends view
    db.exec(`
      CREATE VIEW IF NOT EXISTS velocity_trends AS
      SELECT
        s.id as sprint_id, s.name as sprint_name, s.status,
        s.velocity_committed as committed, s.velocity_completed as completed,
        CASE WHEN s.velocity_committed > 0 THEN ROUND(CAST(s.velocity_completed AS REAL) / s.velocity_committed * 100, 1) ELSE 0 END as completion_rate,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as tickets_done,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as tickets_total,
        (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id) as bugs_found,
        (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id AND status = 'fixed') as bugs_fixed,
        s.start_date, s.end_date, s.created_at
      FROM sprints s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC;
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);`);
  }

  // Composite index on sprints — must run after sprints_v3 rebuild guarantees deleted_at exists
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sprints_status_deleted ON sprints(status, deleted_at);`);
  });
  migrate();
}
