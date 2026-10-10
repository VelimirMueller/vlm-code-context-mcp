/**
 * Hidden bench check for task L3 (PLAN.md task 6).
 *
 * Copied into the live-bench workspace at check time and run there with the
 * repo's vitest. Never shown to the agent. Import paths are relative to the
 * workspace root (`test/` → `src/utils/index.js` resolves to the barrel).
 */
import { describe, it, expect } from 'vitest';
import { parseDuration } from '../src/utils/index.js';

describe('parseDuration (hidden bench check)', () => {
  it('parses plain units', () => {
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('1d')).toBe(86_400_000);
  });

  it('parses compound durations', () => {
    expect(parseDuration('1h 30m')).toBe(5_400_000);
    expect(parseDuration('2m 30s')).toBe(150_000);
    expect(parseDuration('1d 2h')).toBe(93_600_000);
  });

  it('parses compact forms', () => {
    expect(parseDuration('1h30m')).toBe(5_400_000);
    expect(parseDuration('2m30s')).toBe(150_000);
  });

  it('returns null for invalid input', () => {
    expect(parseDuration('not a duration')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('5x')).toBeNull();
    expect(parseDuration('hours')).toBeNull();
  });
});
