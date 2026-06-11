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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "agents" ("id", "role", "name", "description", "model", "tools", "system_prompt", "created_at", "updated_at") VALUES (1, 'legacy-dev', 'Legacy Dev', NULL, NULL, NULL, NULL, '2026-06-11 15:31:04', '2026-06-11 15:31:04');
CREATE TABLE sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      goal TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'implementation', 'qa', 'retro', 'closed')),
      velocity_committed INTEGER DEFAULT 0,
      velocity_completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    , milestone_id INTEGER REFERENCES milestones(id));
INSERT INTO "sprints" ("id", "name", "goal", "start_date", "end_date", "status", "velocity_committed", "velocity_completed", "created_at", "updated_at", "milestone_id") VALUES (1, 'Fixture Sprint 1', 'Legacy fixture goal', NULL, NULL, 'planning', 0, 0, '2026-06-11 15:31:04', '2026-06-11 15:31:04', NULL);
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')), epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
      UNIQUE(sprint_id, ticket_ref)
    );
INSERT INTO "tickets" ("id", "sprint_id", "ticket_ref", "title", "description", "priority", "status", "assigned_to", "story_points", "milestone", "milestone_id", "qa_verified", "verified_by", "acceptance_criteria", "dependencies", "notes", "created_at", "updated_at", "epic_id") VALUES (1, 1, 'T-1', 'Legacy ticket one', NULL, 'P1', 'DONE', NULL, 3, NULL, NULL, 0, NULL, NULL, NULL, NULL, '2026-06-11 15:31:04', '2026-06-11 15:31:04', NULL);
INSERT INTO "tickets" ("id", "sprint_id", "ticket_ref", "title", "description", "priority", "status", "assigned_to", "story_points", "milestone", "milestone_id", "qa_verified", "verified_by", "acceptance_criteria", "dependencies", "notes", "created_at", "updated_at", "epic_id") VALUES (2, 1, 'T-2', 'Legacy ticket two', NULL, 'P2', 'TODO', NULL, 5, NULL, NULL, 0, NULL, NULL, NULL, NULL, '2026-06-11 15:31:04', '2026-06-11 15:31:04', NULL);
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE
    );
INSERT INTO "retro_findings" ("id", "sprint_id", "role", "category", "finding", "action_owner", "action_applied", "created_at") VALUES (1, 1, NULL, 'try_next', 'Legacy try-next finding', NULL, 0, '2026-06-11 15:31:04');
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
INSERT INTO "skills" ("id", "name", "content", "owner_role", "created_at", "updated_at") VALUES (1, 'LEGACY_SKILL', 'legacy content', NULL, '2026-06-11 15:31:04', '2026-06-11 15:31:04');
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
INSERT INTO "decisions" ("id", "title", "rationale", "alternatives", "outcome", "category", "created_at") VALUES (1, 'Legacy decision', NULL, NULL, NULL, 'technical', '2026-06-11 15:31:04');
CREATE TABLE epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
      milestone_id INTEGER REFERENCES milestones(id),
      color TEXT DEFAULT '#3b82f6',
      priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('sprints', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('tickets', 2);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('retro_findings', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('agents', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('skills', 1);
INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('decisions', 1);
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
CREATE INDEX idx_sprints_status ON sprints(status);
CREATE INDEX idx_tickets_milestone_id ON tickets(milestone_id);
CREATE INDEX idx_tickets_epic_id ON tickets(epic_id);
COMMIT;
