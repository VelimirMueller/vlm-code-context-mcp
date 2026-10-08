import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDb } from './helpers/db.js';
import { initScrumSchema, runMigrations } from '../src/scrum/schema.js';
import { registerScrumTools } from '../src/scrum/tools.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { log, sessionLogPath, sanitizeMessage, localTimestamp, logToolExceptions } from '../src/sessionlog.js';

type Handler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _desc: string, _schema: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }
}

const ENV_KEYS = ['OVERDRIVE_SESSION_LOG', 'OVERDRIVE_SESSION_LOG_DIR', 'CLAUDE_CODE_SESSION_ID'] as const;
let saved: Record<string, string | undefined>;
let dir: string;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  // The parent dir exists; the log dir itself must be created by the helper.
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-slog-')), 'sessions');
  delete process.env.OVERDRIVE_SESSION_LOG;
  process.env.OVERDRIVE_SESSION_LOG_DIR = dir;
  process.env.CLAUDE_CODE_SESSION_ID = 'test-session';
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

const readLines = (): string[] => {
  const file = path.join(dir, 'test-session.log');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
};

describe('sessionlog format', () => {
  it('writes one TAB-separated line in the contract format', () => {
    log('INFO', 'hello world');
    const lines = readLines();
    expect(lines).toHaveLength(1);
    const fields = lines[0].split('\t');
    expect(fields).toHaveLength(5);
    expect(fields[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(fields[1]).toBe('INFO');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    expect(fields[2]).toBe(`code-context@${pkg.version}`);
    expect(fields[3]).toBe(`pid=${process.pid}`);
    expect(fields[4]).toBe('hello world');
  });

  it('local timestamp carries the real local offset', () => {
    const d = new Date(Date.UTC(2026, 9, 9, 8, 12, 3, 45));
    const ts = localTimestamp(d);
    expect(new Date(ts).getTime()).toBe(d.getTime());
    expect(ts).toMatch(/\.045[+-]\d{2}:\d{2}$/);
  });

  it('flattens newlines and tabs, caps at 500 characters', () => {
    expect(sanitizeMessage('a\nb\r\nc\td')).toBe('a⏎b⏎c d');
    expect(sanitizeMessage('x'.repeat(900))).toHaveLength(500);
    log('WARN', `line1\nline2\t${'y'.repeat(800)}`);
    const msg = readLines()[0].split('\t')[4];
    expect(msg.startsWith('line1⏎line2 ')).toBe(true);
    expect(msg.length).toBe(500);
  });

  it('maps an unknown level to WARN', () => {
    log('DEBUG', 'm');
    expect(readLines()[0].split('\t')[1]).toBe('WARN');
  });

  it('creates the dir 0700 and the file 0600', () => {
    log('INFO', 'perm');
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(dir, 'test-session.log')).mode & 0o777).toBe(0o600);
  });

  it('sanitises the session id into one path component', () => {
    process.env.CLAUDE_CODE_SESSION_ID = '../evil/id x';
    expect(sessionLogPath()).toBe(path.join(dir, '.._evil_id_x.log'));
  });

  it('falls back to _nosession-YYYY-MM-DD without a session id', () => {
    delete process.env.CLAUDE_CODE_SESSION_ID;
    expect(path.basename(sessionLogPath())).toMatch(/^_nosession-\d{4}-\d{2}-\d{2}\.log$/);
  });

  it('OVERDRIVE_SESSION_LOG=0 disables logging (read at call time)', () => {
    process.env.OVERDRIVE_SESSION_LOG = '0';
    log('INFO', 'off');
    expect(fs.existsSync(dir)).toBe(false);
    delete process.env.OVERDRIVE_SESSION_LOG;
    log('INFO', 'on');
    expect(readLines()).toHaveLength(1);
  });

  it('swallows errors (unwritable log dir)', () => {
    const blocker = path.join(path.dirname(dir), 'not-a-dir');
    fs.writeFileSync(blocker, '');
    process.env.OVERDRIVE_SESSION_LOG_DIR = path.join(blocker, 'sub');
    expect(() => log('CRITICAL', 'boom')).not.toThrow();
  });
});

describe('sessionlog integration — update_ticket', () => {
  it('a status change writes exactly one INFO line with ids only', async () => {
    const db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    const sprintId = Number(
      db.prepare(`INSERT INTO sprints (name, goal, status) VALUES ('SPRINT-SENTINEL-9f3a', 'g', 'implementation')`).run()
        .lastInsertRowid,
    );
    const sentinel = 'TICKET-SENTINEL-7c1e secret title';
    const ticketId = Number(
      db.prepare(`INSERT INTO tickets (title, description, status, sprint_id) VALUES (?, 'DESC-SENTINEL-55b2', 'TODO', ?)`)
        .run(sentinel, sprintId).lastInsertRowid,
    );
    const server = new FakeServer();
    registerScrumTools(server as never, db);

    const res = await server.tools.get('update_ticket')!({ ticket_id: ticketId, status: 'IN_PROGRESS' });
    expect(res.isError).toBeFalsy();

    const lines = readLines();
    expect(lines).toHaveLength(1);
    const [, level, , , msg] = lines[0].split('\t');
    expect(level).toBe('INFO');
    expect(msg).toBe(`update_ticket: ticket=${ticketId} status TODO→IN_PROGRESS`);
    const raw = fs.readFileSync(path.join(dir, 'test-session.log'), 'utf-8');
    expect(raw).not.toContain('SENTINEL');
  });
});

describe('logToolExceptions', () => {
  it('logs CRITICAL with tool name + error class, rethrows, and leaves success untouched', async () => {
    const server = new McpServer({ name: 't', version: '0' });
    const captured = new Map<string, (...a: unknown[]) => Promise<unknown>>();
    const realTool = server.tool.bind(server) as (...a: unknown[]) => unknown;
    (server as unknown as { tool: (...a: unknown[]) => unknown }).tool = (...a: unknown[]) => {
      captured.set(String(a[0]), a[a.length - 1] as (...x: unknown[]) => Promise<unknown>);
      return realTool(...a);
    };
    logToolExceptions(server);
    server.tool('boom', 'd', { id: z.number() }, async () => {
      throw Object.assign(new TypeError('SECRET-VALUE-in-message'), { code: 'E_X' });
    });
    server.tool('ok', 'd', {}, async () => ({ content: [{ type: 'text' as const, text: 'fine' }] }));

    await expect(captured.get('boom')!({ id: 1 }, {})).rejects.toThrow(TypeError);
    await expect(captured.get('ok')!({}, {})).resolves.toEqual({ content: [{ type: 'text', text: 'fine' }] });

    const lines = readLines();
    expect(lines).toHaveLength(1);
    const [, level, , , msg] = lines[0].split('\t');
    expect(level).toBe('CRITICAL');
    expect(msg).toBe('tool boom: unhandled exception error=TypeError(E_X)');
    expect(lines[0]).not.toContain('SECRET');
  });
});
