import type Database from "better-sqlite3";

/**
 * Archive / unarchive for milestones and epics (schema v24) — the single source of truth
 * shared by the MCP tools (update_milestone / update_epic `archived`) and the dashboard
 * routes (POST /api/{milestone,epic}/:id/{archive,unarchive}).
 *
 * Mirrors sprint archiving (handlers/sprint.ts apiArchiveSprint): archive state is
 * orthogonal to status and to soft-delete, eligibility is enforced server-side, and every
 * state change writes one event_log row (field_name = 'archived_at').
 *
 * Differences from sprints: only `completed` rows are eligible unless `force` is set
 * (sprints have no force), and re-archiving an already-archived row is a no-op that keeps
 * the original archived_at and writes no audit event.
 *
 * The audit insert is best-effort, exactly like apiArchiveSprint: a failing event_log write
 * is logged and never blocks the archive itself.
 */

export type ArchivableEntity = "milestone" | "epic";

const TABLE: Record<ArchivableEntity, "milestones" | "epics"> = {
  milestone: "milestones",
  epic: "epics",
};

/** Statuses that may be archived without `force`. */
export const ARCHIVABLE_ENTITY_STATUSES = ["completed"] as const;

export interface ArchiveResult {
  ok: true;
  archived_at: string | null;
  /** false when the call was a no-op (already in the requested state). */
  changed: boolean;
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function loadRow(db: Database.Database, entity: ArchivableEntity, id: number) {
  const row = db
    .prepare(`SELECT id, status, archived_at FROM ${TABLE[entity]} WHERE id = ? AND deleted_at IS NULL`)
    .get(id) as { id: number; status: string; archived_at: string | null } | undefined;
  if (!row) throw httpError(`${entity} not found`, 404);
  return row;
}

function audit(
  db: Database.Database,
  entity: ArchivableEntity,
  id: number,
  oldValue: string | null,
  newValue: string | null,
  actor: string,
): void {
  try {
    db.prepare(
      "INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES (?, ?, 'updated', 'archived_at', ?, ?, ?)",
    ).run(entity, id, oldValue, newValue, actor);
  } catch (e) {
    console.error(`[archive] ${entity} audit error:`, e);
  }
}

/**
 * Check archive eligibility without writing. `statusOverride` lets a caller validate
 * against a status it is about to set in the same operation (update_milestone with
 * status='completed' + archived=true).
 */
export function assertArchivable(
  db: Database.Database,
  entity: ArchivableEntity,
  id: number,
  opts: { force?: boolean; statusOverride?: string } = {},
): { id: number; status: string; archived_at: string | null } {
  const row = loadRow(db, entity, id);
  const status = opts.statusOverride ?? row.status;
  if (!opts.force && !(ARCHIVABLE_ENTITY_STATUSES as readonly string[]).includes(status)) {
    throw httpError(
      `only completed ${entity}s can be archived (status must be one of: ${ARCHIVABLE_ENTITY_STATUSES.join(", ")}); got '${status}' — pass force to archive anyway`,
      400,
    );
  }
  return row;
}

export function archiveEntity(
  db: Database.Database,
  entity: ArchivableEntity,
  id: number,
  opts: { force?: boolean; actor: string },
): ArchiveResult {
  // Check + write in one transaction (nests as a savepoint inside the MCP tools' own).
  return db.transaction((): ArchiveResult => {
    const row = assertArchivable(db, entity, id, { force: opts.force });
    if (row.archived_at !== null) return { ok: true, archived_at: row.archived_at, changed: false };
    const table = TABLE[entity];
    db.prepare(`UPDATE ${table} SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
    const { archived_at } = db.prepare(`SELECT archived_at FROM ${table} WHERE id = ?`).get(id) as { archived_at: string };
    audit(db, entity, id, null, archived_at, opts.actor);
    return { ok: true, archived_at, changed: true };
  })();
}

export function unarchiveEntity(
  db: Database.Database,
  entity: ArchivableEntity,
  id: number,
  opts: { actor: string },
): ArchiveResult {
  return db.transaction((): ArchiveResult => {
    const row = loadRow(db, entity, id);
    if (row.archived_at === null) return { ok: true, archived_at: null, changed: false };
    db.prepare(`UPDATE ${TABLE[entity]} SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);
    audit(db, entity, id, row.archived_at, null, opts.actor);
    return { ok: true, archived_at: null, changed: true };
  })();
}
