PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE files (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      path             TEXT UNIQUE NOT NULL,
      language         TEXT,
      extension        TEXT,
      size_bytes       INTEGER,
      line_count       INTEGER,
      summary          TEXT,
      description      TEXT,
      external_imports TEXT,
      content          TEXT,
      created_at       TEXT,
      modified_at      TEXT,
      indexed_at       TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE exports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      kind        TEXT,
      description TEXT
    );
CREATE TABLE dependencies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      symbols   TEXT,
      UNIQUE(source_id, target_id)
    );
CREATE TABLE directories (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      path             TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      parent_path      TEXT,
      depth            INTEGER NOT NULL DEFAULT 0,
      file_count       INTEGER NOT NULL DEFAULT 0,
      total_size_bytes INTEGER NOT NULL DEFAULT 0,
      total_lines      INTEGER NOT NULL DEFAULT 0,
      language_breakdown TEXT,
      description      TEXT,
      indexed_at       TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE changes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      event     TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      old_summary   TEXT,
      new_summary   TEXT,
      old_line_count INTEGER,
      new_line_count INTEGER,
      old_size_bytes INTEGER,
      new_size_bytes INTEGER,
      old_exports   TEXT,
      new_exports   TEXT,
      diff_text     TEXT,
      reason        TEXT
    );
CREATE TABLE agents (
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
INSERT INTO "agents" ("id", "role", "name", "description", "model", "tools", "system_prompt", "department", "created_at", "updated_at") VALUES (1, 'legacy-dev', 'Legacy Dev', NULL, NULL, NULL, NULL, 'development', '2026-06-11 15:31:07', '2026-06-11 15:31:07');
CREATE TABLE tickets (
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL, estimated_hours REAL, actual_hours REAL,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
      UNIQUE(sprint_id, ticket_ref)
    );
INSERT INTO "tickets" ("id", "sprint_id", "ticket_ref", "title", "description", "priority", "status", "assigned_to", "story_points", "milestone", "milestone_id", "qa_verified", "verified_by", "acceptance_criteria", "dependencies", "notes", "deleted_at", "created_at", "updated_at", "epic_id", "estimated_hours", "actual_hours") VALUES (1, 1, 'T-1', 'Legacy ticket one', NULL, 'P1', 'DONE', NULL, 3, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-06-11 15:31:07', '2026-06-11 15:31:07', NULL, NULL, NULL);
INSERT INTO "tickets" ("id", "sprint_id", "ticket_ref", "title", "description", "priority", "status", "assigned_to", "story_points", "milestone", "milestone_id", "qa_verified", "verified_by", "acceptance_criteria", "dependencies", "notes", "deleted_at", "created_at", "updated_at", "epic_id", "estimated_hours", "actual_hours") VALUES (2, 1, 'T-2', 'Legacy ticket two', NULL, 'P2', 'TODO', NULL, 5, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-06-11 15:31:07', '2026-06-11 15:31:07', NULL, NULL, NULL);
CREATE TABLE subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      assigned_to TEXT,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
CREATE TABLE retro_findings (
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
INSERT INTO "retro_findings" ("id", "sprint_id", "role", "category", "finding", "action_owner", "action_applied", "linked_ticket_id", "created_at") VALUES (1, 1, NULL, 'try_next', 'Legacy try-next finding', NULL, 0, NULL, '2026-06-11 15:31:07');
CREATE TABLE blockers (
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
CREATE TABLE bugs (
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
CREATE TABLE skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT,
      owner_role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "skills" ("id", "name", "content", "owner_role", "created_at", "updated_at") VALUES (1, 'LEGACY_SKILL', 'legacy content', NULL, '2026-06-11 15:31:07', '2026-06-11 15:31:07');
CREATE TABLE processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      content TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
CREATE TABLE milestones (
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
CREATE TABLE decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      rationale TEXT,
      alternatives TEXT,
      outcome TEXT,
      category TEXT DEFAULT 'technical',
      created_at TEXT DEFAULT (datetime('now'))
    );
INSERT INTO "decisions" ("id", "title", "rationale", "alternatives", "outcome", "category", "created_at") VALUES (1, 'Legacy decision', NULL, NULL, NULL, 'technical', '2026-06-11 15:31:07');
CREATE TABLE epics (
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
CREATE TABLE sprint_metrics (
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
CREATE TABLE ticket_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_ticket_id INTEGER NOT NULL,
      target_ticket_id INTEGER NOT NULL,
      dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'blocked_by', 'related')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      UNIQUE(source_ticket_id, target_ticket_id, dependency_type)
    );
CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (1, 'tech-debt', '#ef4444', '2026-06-11 15:31:07');
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (2, 'security', '#f59e0b', '2026-06-11 15:31:07');
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (3, 'ux', '#8b5cf6', '2026-06-11 15:31:07');
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (4, 'bug', '#dc2626', '2026-06-11 15:31:07');
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (5, 'performance', '#10b981', '2026-06-11 15:31:07');
INSERT INTO "tags" ("id", "name", "color", "created_at") VALUES (6, 'documentation', '#6366f1', '2026-06-11 15:31:07');
CREATE TABLE ticket_tags (
      ticket_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (ticket_id, tag_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
CREATE TABLE agent_mood_history (
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
CREATE TABLE event_log (
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
INSERT INTO "event_log" ("id", "entity_type", "entity_id", "action", "field_name", "old_value", "new_value", "actor", "created_at") VALUES (1, 'ticket', 1, 'created', NULL, NULL, NULL, NULL, '2026-06-11 15:31:07');
CREATE TABLE token_usage (
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
CREATE TABLE schema_versions (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (1, 'add_epic_id_to_tickets', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (2, 'add_milestone_id_to_sprints', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (3, 'add_decisions_table', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (4, 'sprint_phases_v2', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (5, 'sprint_10_phases', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (6, 'add_time_tracking_to_tickets', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (7, 'add_review_status_to_tickets', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (8, 'seed_default_tags', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (9, 'create_velocity_trends_view', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (10, 'create_linear_normalized_tables', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (11, 'create_discoveries_table', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (12, 'create_pending_actions_table', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (13, 'create_workflow_orchestration_tables', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (14, 'add_retro_linked_ticket_id', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (15, 'add_resolution_plan_to_discoveries', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (16, 'drop_linear_tables', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (17, 'simplify_sprint_phases_add_done', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (18, 'add_department_to_agents', '2026-06-11 15:31:07');
INSERT INTO "schema_versions" ("version", "name", "applied_at") VALUES (19, 'add_ticket_composite_index', '2026-06-11 15:31:07');
CREATE TABLE discoveries (
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
      , resolution_plan TEXT);
INSERT INTO "discoveries" ("id", "discovery_sprint_id", "finding", "category", "status", "priority", "implementation_ticket_id", "drop_reason", "created_by", "created_at", "updated_at", "resolution_plan") VALUES (1, 1, 'Legacy discovery', 'general', 'discovered', 'P1', NULL, NULL, NULL, '2026-06-11 15:31:07', '2026-06-11 15:31:07', NULL);
CREATE TABLE pending_actions (
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
CREATE TABLE workflow_runs (
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
CREATE TABLE workflow_step_log (
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
CREATE TABLE "sprints" (
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
        milestone_id INTEGER REFERENCES milestones(id),
        deleted_at TEXT DEFAULT NULL
      );
INSERT INTO "sprints" ("id", "name", "goal", "start_date", "end_date", "status", "velocity_committed", "velocity_completed", "created_at", "updated_at", "milestone_id", "deleted_at") VALUES (1, 'Fixture Sprint 1', 'Legacy fixture goal', NULL, NULL, 'planning', 0, 0, '2026-06-11 15:31:07', '2026-06-11 15:31:07', NULL, NULL);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('tags', 6);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('sprints', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('tickets', 2);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('retro_findings', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('agents', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('skills', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('decisions', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('discoveries', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('event_log', 1);
CREATE INDEX idx_files_ext ON files(extension);
CREATE INDEX idx_files_lang ON files(language);
CREATE INDEX idx_exports_name ON exports(name);
CREATE INDEX idx_exports_file ON exports(file_id);
CREATE INDEX idx_deps_source ON dependencies(source_id);
CREATE INDEX idx_deps_target ON dependencies(target_id);
CREATE INDEX idx_dirs_path ON directories(path);
CREATE INDEX idx_dirs_parent ON directories(parent_path);
CREATE INDEX idx_changes_path ON changes(file_path);
CREATE INDEX idx_changes_ts ON changes(timestamp DESC);
CREATE INDEX idx_milestones_status ON milestones(status);
CREATE INDEX idx_epics_status ON epics(status);
CREATE INDEX idx_epics_milestone ON epics(milestone_id);
CREATE INDEX idx_tickets_sprint_id ON tickets(sprint_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_subtasks_ticket_id ON subtasks(ticket_id);
CREATE INDEX idx_retro_findings_sprint_id ON retro_findings(sprint_id);
CREATE INDEX idx_blockers_sprint_id ON blockers(sprint_id);
CREATE INDEX idx_bugs_sprint_id ON bugs(sprint_id);
CREATE INDEX idx_sprint_metrics_sprint ON sprint_metrics(sprint_id);
CREATE INDEX idx_ticket_deps_source ON ticket_dependencies(source_ticket_id);
CREATE INDEX idx_ticket_deps_target ON ticket_dependencies(target_ticket_id);
CREATE INDEX idx_mood_history_agent ON agent_mood_history(agent_id);
CREATE INDEX idx_mood_history_sprint ON agent_mood_history(sprint_id);
CREATE INDEX idx_event_log_entity ON event_log(entity_type, entity_id);
CREATE INDEX idx_event_log_created ON event_log(created_at);
CREATE INDEX idx_tickets_sprint_deleted ON tickets(sprint_id, deleted_at);
CREATE INDEX idx_tickets_milestone_id ON tickets(milestone_id);
CREATE INDEX idx_tickets_epic_id ON tickets(epic_id);
CREATE INDEX idx_discoveries_sprint ON discoveries(discovery_sprint_id);
CREATE INDEX idx_discoveries_status ON discoveries(status);
CREATE INDEX idx_pending_actions_status ON pending_actions(status, created_at);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_step_log_workflow ON workflow_step_log(workflow_id);
CREATE INDEX idx_sprints_status ON sprints(status);
CREATE INDEX idx_sprints_status_deleted ON sprints(status, deleted_at);
CREATE VIEW velocity_trends AS
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
COMMIT;
