import Database from "better-sqlite3";

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      path             TEXT UNIQUE NOT NULL,
      language         TEXT,
      extension        TEXT,
      size_bytes       INTEGER,
      line_count       INTEGER,
      summary          TEXT,
      external_imports TEXT,
      content          TEXT,
      created_at       TEXT,
      modified_at      TEXT,
      indexed_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      kind        TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      symbols   TEXT,
      UNIQUE(source_id, target_id)
    );

    CREATE INDEX IF NOT EXISTS idx_files_ext ON files(extension);
    CREATE INDEX IF NOT EXISTS idx_files_lang ON files(language);
    CREATE INDEX IF NOT EXISTS idx_exports_name ON exports(name);
    CREATE INDEX IF NOT EXISTS idx_exports_file ON exports(file_id);
    CREATE INDEX IF NOT EXISTS idx_deps_source ON dependencies(source_id);
    CREATE INDEX IF NOT EXISTS idx_deps_target ON dependencies(target_id);

    CREATE TABLE IF NOT EXISTS changes (
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
      diff_text     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_changes_path ON changes(file_path);
    CREATE INDEX IF NOT EXISTS idx_changes_ts ON changes(timestamp DESC);
  `);
}
