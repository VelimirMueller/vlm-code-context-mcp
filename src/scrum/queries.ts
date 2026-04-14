/**
 * Data Access Layer for scrum operations.
 * Centralizes all common SQL queries to eliminate duplication in tool handlers.
 */
import type Database from "better-sqlite3";

// ═════════════════════════════════════════════════════════════════════════════
// Sprint queries
// ═════════════════════════════════════════════════════════════════════════════

export function getSprintById(db: Database.Database, id: number): any | null {
  return db.prepare("SELECT * FROM sprints WHERE id = ?").get(id) ?? null;
}

export function getSprintByIdSafe(db: Database.Database, id: number): any | null {
  return db.prepare("SELECT * FROM sprints WHERE id = ? AND deleted_at IS NULL").get(id) ?? null;
}

export function getActiveSprint(db: Database.Database): any | null {
  return db.prepare(
    "SELECT * FROM sprints WHERE status NOT IN ('closed', 'rest') AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
  ).get() ?? null;
}

export function getActiveSprintId(db: Database.Database): number | null {
  const row = db.prepare(
    "SELECT id FROM sprints WHERE status NOT IN ('rest', 'done', 'closed') AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
  ).get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function getLatestSprintId(db: Database.Database): number | null {
  const row = db.prepare(
    "SELECT id FROM sprints WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1"
  ).get() as { id: number } | undefined;
  return row?.id ?? null;
}

export function getCompletedSprintCount(db: Database.Database): number {
  return (db.prepare(
    "SELECT COUNT(*) as c FROM sprints WHERE status IN ('rest', 'done', 'closed') AND deleted_at IS NULL"
  ).get() as { c: number }).c;
}

// ═════════════════════════════════════════════════════════════════════════════
// Ticket queries
// ═════════════════════════════════════════════════════════════════════════════

export function getTicketsBySprintId(db: Database.Database, sprintId: number): any[] {
  return db.prepare(
    "SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL"
  ).all(sprintId);
}

export function getTicketById(db: Database.Database, id: number): any | null {
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) ?? null;
}

export function getTicketWithSprint(db: Database.Database, ticketId: number): any | null {
  return db.prepare(
    "SELECT t.*, s.status as sprint_status, s.name as sprint_name FROM tickets t LEFT JOIN sprints s ON t.sprint_id = s.id WHERE t.id = ?"
  ).get(ticketId) ?? null;
}

export function getTicketStatusCounts(db: Database.Database, sprintId: number): Record<string, number> {
  const rows = db.prepare(
    "SELECT status, COUNT(*) as c FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL GROUP BY status"
  ).all(sprintId) as { status: string; c: number }[];
  const result: Record<string, number> = {};
  for (const r of rows) result[r.status] = r.c;
  return result;
}

export function getTicketPoints(db: Database.Database, sprintId: number): { total: number; done: number } {
  const tickets = getTicketsBySprintId(db, sprintId);
  return {
    total: tickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0),
    done: tickets.filter((t: any) => t.status === "DONE").reduce((s: number, t: any) => s + (t.story_points || 0), 0),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Counts
// ═════════════════════════════════════════════════════════════════════════════

export function countTable(db: Database.Database, table: string, where?: string, params?: any[]): number {
  const sql = `SELECT COUNT(*) as c FROM ${table}${where ? ` WHERE ${where}` : ""}`;
  return (db.prepare(sql).get(...(params ?? [])) as { c: number }).c;
}

export function getOpenBlockerCount(db: Database.Database, sprintId: number): number {
  return countTable(db, "blockers", "sprint_id = ? AND status = 'open'", [sprintId]);
}

export function getRetroFindingCount(db: Database.Database, sprintId: number): number {
  return countTable(db, "retro_findings", "sprint_id = ?", [sprintId]);
}

// ═════════════════════════════════════════════════════════════════════════════
// Agent queries
// ═════════════════════════════════════════════════════════════════════════════

export function getValidRoles(db: Database.Database): Set<string> {
  return new Set(
    (db.prepare("SELECT role FROM agents").all() as { role: string }[]).map(a => a.role)
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Event logging
// ═════════════════════════════════════════════════════════════════════════════

export function logEvent(
  db: Database.Database,
  entityType: string, entityId: number, action: string,
  fieldName?: string, oldValue?: string, newValue?: string, actor?: string
): void {
  try {
    db.prepare(
      "INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(entityType, entityId, action, fieldName ?? null, oldValue ?? null, newValue ?? null, actor ?? "mcp");
  } catch (e: any) {
    console.error("[event_log]", e?.message ?? e);
  }
}
