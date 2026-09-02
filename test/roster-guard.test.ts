import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/db.js';
import { initScrumSchema, runMigrations } from '../src/scrum/schema.js';
import {
  buildModelRoutingSection,
  registerScrumTools,
  unknownRosterRole,
} from '../src/scrum/tools.js';
import { KNOWN_AGENT_MODELS } from '../src/scrum/agent-model.js';
import Database from 'better-sqlite3';

type Handler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _desc: string, _schema: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }
}

function setup(roles: string[] = ['developer', 'architect']): {
  db: Database.Database;
  tools: Map<string, Handler>;
  sprintId: number;
} {
  const db = createTestDb();
  initScrumSchema(db);
  runMigrations(db);
  for (const role of roles)
    db.prepare(`INSERT INTO agents (role, name, model) VALUES (?, ?, 'claude-sonnet-5')`).run(
      role,
      role,
    );
  const sprintId = Number(
    db.prepare(`INSERT INTO sprints (name, goal, status) VALUES ('s', 'g', 'planning')`).run()
      .lastInsertRowid,
  );
  const server = new FakeServer();
  registerScrumTools(server as never, db);
  return { db, tools: server.tools, sprintId };
}

const text = (res: { content: Array<{ text: string }> }): string =>
  res.content.map((c) => c.text).join('\n');

describe('unknownRosterRole', () => {
  it('accepts roster roles, null, and anything when the roster is empty', () => {
    const { db } = setup();
    expect(unknownRosterRole(db, 'developer')).toBeNull();
    expect(unknownRosterRole(db, null)).toBeNull();
    expect(unknownRosterRole(db, undefined)).toBeNull();
    const empty = setup([]).db;
    expect(unknownRosterRole(empty, 'whatever')).toBeNull();
  });
  it('names the offending value, the valid roles, and the tag alternative', () => {
    const msg = unknownRosterRole(setup().db, 'opus');
    expect(msg).toContain('"opus"');
    expect(msg).toContain('developer');
    expect(msg).toContain('impl:');
  });
});

describe('create_ticket / update_ticket roster guard', () => {
  it('rejects a model name in assigned_to instead of silently routing to sonnet', async () => {
    const { db, tools, sprintId } = setup();
    const res = await tools.get('create_ticket')!({
      sprint_id: sprintId,
      title: 'T',
      priority: 'P2',
      assigned_to: 'opus',
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('roster role');
    expect(db.prepare(`SELECT COUNT(*) as c FROM tickets`).get()).toEqual({ c: 0 });
  });
  it("accepts a roster role and routes it through the agent's model", async () => {
    const { db, tools, sprintId } = setup();
    const res = await tools.get('create_ticket')!({
      sprint_id: sprintId,
      title: 'T',
      priority: 'P2',
      assigned_to: 'developer',
    });
    expect(res.isError).toBeUndefined();
    const ticket = db.prepare(`SELECT * FROM tickets`).get() as any;
    expect(buildModelRoutingSection(db, ticket)).toContain('tier `sonnet`');
  });
  it('still accepts any assignee when the roster is empty (agentless mode)', async () => {
    const { tools, sprintId } = setup([]);
    const res = await tools.get('create_ticket')!({
      sprint_id: sprintId,
      title: 'T',
      priority: 'P2',
      assigned_to: 'dev',
    });
    expect(res.isError).toBeUndefined();
  });
  it('update_ticket rejects a provider name in assigned_to and leaves the row untouched', async () => {
    const { db, tools, sprintId } = setup();
    await tools.get('create_ticket')!({
      sprint_id: sprintId,
      title: 'T',
      priority: 'P2',
      assigned_to: 'developer',
    });
    const id = (db.prepare(`SELECT id FROM tickets`).get() as any).id;
    const res = await tools.get('update_ticket')!({ ticket_id: id, assigned_to: 'glm' });
    expect(res.isError).toBe(true);
    expect(
      (db.prepare(`SELECT assigned_to FROM tickets WHERE id = ?`).get(id) as any).assigned_to,
    ).toBe('developer');
  });
});

describe('update_agent', () => {
  it('changes the model and reports the resulting tier', async () => {
    const { db, tools, sprintId } = setup();
    const res = await tools.get('update_agent')!({
      role: 'developer',
      model: 'claude-opus-5',
      tools: 'Agent model:opus',
      system_prompt: 'Implements.',
    });
    expect(res.isError).toBeUndefined();
    expect(text(res)).toContain('tier opus');
    const row = db
      .prepare(`SELECT model, tools, system_prompt FROM agents WHERE role = 'developer'`)
      .get() as any;
    expect(row).toEqual({
      model: 'claude-opus-5',
      tools: 'Agent model:opus',
      system_prompt: 'Implements.',
    });
    await tools.get('create_ticket')!({
      sprint_id: sprintId,
      title: 'T',
      priority: 'P2',
      assigned_to: 'developer',
    });
    const ticket = db.prepare(`SELECT * FROM tickets`).get() as any;
    expect(buildModelRoutingSection(db, ticket)).toContain('tier `opus`');
  });
  it('rejects unknown models and unknown roles, and clears nullable fields with null', async () => {
    const { db, tools } = setup();
    const bad = await tools.get('update_agent')!({ role: 'developer', model: 'glm-5.3' });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain(KNOWN_AGENT_MODELS[0]);
    const missing = await tools.get('update_agent')!({ role: 'nobody', model: 'claude-opus-5' });
    expect(missing.isError).toBe(true);
    await tools.get('update_agent')!({ role: 'developer', tools: 'x' });
    await tools.get('update_agent')!({ role: 'developer', tools: null });
    expect(
      (db.prepare(`SELECT tools FROM agents WHERE role = 'developer'`).get() as any).tools,
    ).toBeNull();
    const noop = await tools.get('update_agent')!({ role: 'developer' });
    expect(text(noop)).toContain('Nothing to update');
  });
});
