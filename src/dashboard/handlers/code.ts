/**
 * Code-intel handlers — files, file-context, graph, changes, directories.
 *
 * Migrated out of ../dashboard.ts (T-277) along the plan documented in
 * ./index.ts. Each function takes the shared Database connection and returns
 * plain data; the router in dashboard.ts calls these instead of inline query
 * logic. Query bodies are byte-identical to the originals — zero route-surface
 * change.
 */
import type Database from "better-sqlite3";

export function apiFiles(db: Database.Database) {
  return db.prepare(`
    SELECT f.id, f.path, f.language, f.extension, f.size_bytes, f.line_count,
      f.summary, f.external_imports, f.created_at, f.modified_at, f.indexed_at,
      (SELECT COUNT(*) FROM exports WHERE file_id = f.id) as export_count,
      (SELECT COUNT(*) FROM dependencies WHERE source_id = f.id) as imports_count,
      (SELECT COUNT(*) FROM dependencies WHERE target_id = f.id) as imported_by_count
    FROM files f ORDER BY f.path
  `).all();
}

export function apiFileContext(db: Database.Database, id: number) {
  const file = db.prepare(`SELECT id, path, language, extension, size_bytes, line_count, summary, description, external_imports, created_at, modified_at, indexed_at FROM files WHERE id = ?`).get(id) as any;
  if (!file) return null;
  const exports = db.prepare(`SELECT name, kind, description FROM exports WHERE file_id = ?`).all(id);
  const imports = db.prepare(`
    SELECT f.id, f.path, f.summary, d.symbols
    FROM dependencies d JOIN files f ON d.target_id = f.id WHERE d.source_id = ?
  `).all(id);
  const importedBy = db.prepare(`
    SELECT f.id, f.path, f.summary, d.symbols
    FROM dependencies d JOIN files f ON d.source_id = f.id WHERE d.target_id = ?
  `).all(id);
  return { ...file, exports, imports, importedBy };
}

export function apiGraph(db: Database.Database) {
  const files = db.prepare(`SELECT id, path FROM files`).all() as any[];
  const deps = db.prepare(`SELECT source_id, target_id, symbols FROM dependencies`).all() as any[];
  return {
    nodes: files.map(f => ({ id: f.id, label: f.path.split("/").slice(-2).join("/") })),
    edges: deps.map(d => ({ source: d.source_id, target: d.target_id, symbols: d.symbols })),
  };
}

export function apiDirectories(db: Database.Database) {
  return db.prepare(`SELECT * FROM directories ORDER BY path`).all();
}

export function apiChanges(db: Database.Database, limit: number) {
  return db.prepare(`
    SELECT id, file_path, event, timestamp,
      old_summary, new_summary,
      old_line_count, new_line_count,
      old_size_bytes, new_size_bytes,
      old_exports, new_exports
    FROM changes ORDER BY timestamp DESC, id DESC LIMIT ?
  `).all(limit);
}

export function apiFileChanges(db: Database.Database, id: number, limit: number) {
  const file = db.prepare(`SELECT path FROM files WHERE id = ?`).get(id) as { path: string } | undefined;
  if (!file) return null;
  return db.prepare(`
    SELECT id, file_path, event, timestamp,
      old_summary, new_summary,
      old_line_count, new_line_count,
      old_size_bytes, new_size_bytes,
      old_exports, new_exports,
      diff_text, reason
    FROM changes WHERE file_path = ? ORDER BY timestamp DESC, id DESC LIMIT ?
  `).all(file.path, limit);
}
