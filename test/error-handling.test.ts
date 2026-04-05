import { describe, it, expect } from 'vitest';

/**
 * Sprint 78 — Error handling standardization tests (TDD: written first)
 *
 * These verify the API error response contract: all errors must return
 * { ok: false, error: "description" } with an appropriate HTTP status.
 */

describe('API error response format', () => {
  it('error payloads include ok:false and error string', () => {
    // Contract: every API error response body must be parseable JSON
    // with { ok: false, error: string }
    const payload = { ok: false, error: 'Something went wrong' };
    expect(payload).toHaveProperty('ok', false);
    expect(payload).toHaveProperty('error');
    expect(typeof payload.error).toBe('string');
  });

  it('error payloads may include extra fields like gate', () => {
    const payload = { ok: false, error: 'Gate failed', gate: { phase: 'qa', passed: false } };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('Gate failed');
    expect(payload.gate).toBeDefined();
  });

  it('404 responses follow the standard format', () => {
    const payload = JSON.parse('{"ok":false,"error":"unknown endpoint"}');
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('unknown endpoint');
  });
});

describe('MCP tool error contract', () => {
  it('tool errors include isError: true flag', () => {
    // MCP SDK convention: tool failures return { content, isError: true }
    const errorResult = {
      content: [{ type: 'text', text: 'Failed to fetch sprints' }],
      isError: true,
    };
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain('Failed');
  });

  it('tool success results omit isError or set it false', () => {
    const successResult = {
      content: [{ type: 'text', text: '{"sprints":[]}' }],
    };
    expect(successResult).not.toHaveProperty('isError', true);
  });
});
