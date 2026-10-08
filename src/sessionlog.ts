// Overdrive session log — one shared, append-only breadcrumb file per Claude
// Code session, written by every local tool (contract: overdrive SESSION-LOG.md).
//
//   <ts>\t<LEVEL>\tcode-context@<version>\tpid=<pid>\t<message>
//
// Rules this helper enforces:
// - stdout is the MCP stdio transport: never print anything, ever.
// - one fs.writeSync per line on an fd opened O_APPEND, so lines from
//   concurrent writers never interleave and survive a crash.
// - only a regular file is written: the open uses O_NOFOLLOW|O_NONBLOCK and the
//   OPEN handle is fstat'ed, so a symlink, directory or fifo planted at the log
//   path gets nothing (no check-then-write window).
// - logging never breaks the tool: every error is swallowed.
// - env is read at call time (tests and long-lived servers can flip it).
// - callers log ids, counts, durations and error classes — never titles,
//   descriptions, retro text, file contents, tokens or SQL values.
// Node stdlib only.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LogLevel = "INFO" | "WARN" | "CRITICAL";

const LEVELS: ReadonlySet<string> = new Set(["INFO", "WARN", "CRITICAL"]);
const MAX_MSG = 500;

let cachedVersion: string | null = null;

/** Package version; src/ and dist/ both sit one level below package.json. */
function toolVersion(): string {
  if (cachedVersion !== null) return cachedVersion;
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../package.json");
    cachedVersion = String(JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version ?? "0");
  } catch {
    cachedVersion = "0";
  }
  return cachedVersion;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local ISO-8601 with milliseconds and a +HH:MM offset. */
export function localTimestamp(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Resolved log file for the current env (read at call time). */
export function sessionLogPath(now: Date = new Date()): string {
  const dir =
    process.env.OVERDRIVE_SESSION_LOG_DIR ||
    path.join(os.homedir(), ".claude", ".local_ai_setup_logs", "sessions");
  const raw = process.env.CLAUDE_CODE_SESSION_ID || `_nosession-${localDate(now)}`;
  // The session id becomes a path component — keep it exactly one.
  const id = raw.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(dir, `${id}.log`);
}

/** One line: newlines → ⏎, tabs → space, capped at 500 characters. */
export function sanitizeMessage(msg: unknown): string {
  let s = String(msg).replace(/\r\n|\r|\n/g, "⏎").replace(/\t/g, " ");
  if (s.length > MAX_MSG) s = Array.from(s).slice(0, MAX_MSG).join("");
  return s;
}

/** Error class (+ code when present) — never the message, which can carry values. */
export function errorClass(err: unknown): string {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name ?? (err as object).constructor?.name ?? "Error";
    const code = (err as { code?: unknown }).code;
    return code !== undefined && code !== null ? `${String(name)}(${String(code)})` : String(name);
  }
  return typeof err;
}

/** Append one line to the session log. Never throws, never prints. */
export function log(level: string, msg: unknown): void {
  try {
    if (process.env.OVERDRIVE_SESSION_LOG === "0") return;
    const lvl = LEVELS.has(level) ? level : "WARN";
    const now = new Date();
    const file = sessionLogPath(now);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const line =
      `${localTimestamp(now)}\t${lvl}\tcode-context@${toolVersion()}\tpid=${process.pid}\t` +
      `${sanitizeMessage(msg)}\n`;
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    // No O_NOFOLLOW on this platform → a symlink could redirect the append: write nothing.
    if (O_NOFOLLOW === undefined) return;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | O_NOFOLLOW | O_NONBLOCK, 0o600);
    try {
      if (fs.fstatSync(fd).isFile()) fs.writeSync(fd, line);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // Logging never breaks the tool.
  }
}

const patchedServers = new WeakSet<object>();

/**
 * Patch `server.tool(name, ..., handler)` so every handler registered from now
 * on logs ONE CRITICAL line (tool name + error class) when it throws or
 * rejects, then rethrows unchanged — the MCP SDK still turns it into its usual
 * error result. Every other registration argument (description, zod schema,
 * annotations) passes through untouched; the handler keeps its `this`, every
 * call argument, its arity and its sync/async behaviour. Idempotent: a second
 * call on the same server is a no-op. Call before any tool is registered.
 */
export function logToolExceptions(server: object): void {
  if (patchedServers.has(server)) return;
  const target = server as { tool?: unknown };
  if (typeof target.tool !== "function") return;
  const original = target.tool as (...args: unknown[]) => unknown;
  patchedServers.add(server);

  target.tool = function patchedTool(this: unknown, ...args: unknown[]): unknown {
    const name = args[0];
    const last = args.length - 1;
    const handler = args[last];
    if (args.length >= 2 && typeof name === "string" && typeof handler === "function") {
      const fn = handler as (...a: unknown[]) => unknown;
      const report = (err: unknown): void =>
        log("CRITICAL", `tool ${name}: unhandled exception error=${errorClass(err)}`);
      const wrapped = function (this: unknown, ...callArgs: unknown[]): unknown {
        let result: unknown;
        try {
          result = fn.apply(this, callArgs);
        } catch (err) {
          report(err);
          throw err;
        }
        if (result && typeof (result as { then?: unknown }).then === "function") {
          return (result as Promise<unknown>).then(undefined, (err: unknown) => {
            report(err);
            throw err;
          });
        }
        return result;
      };
      Object.defineProperty(wrapped, "length", { value: fn.length });
      Object.defineProperty(wrapped, "name", { value: fn.name });
      args = args.slice();
      args[last] = wrapped;
    }
    return original.apply(this === undefined ? server : this, args);
  };
}

const THROTTLE_MAX_KEYS = 256;
const throttleState = new Map<string, { last: number; suppressed: number }>();

/**
 * At most one line per `key` per `windowMs`. Repeats inside the window are
 * counted, and the next line that gets through carries ` suppressed=<n>`.
 * The key table is bounded: past THROTTLE_MAX_KEYS live keys, all further
 * keys share one overflow bucket, so varying the key cannot flood the log.
 */
export function logThrottled(key: string, level: string, msg: string, windowMs = 60_000, now = Date.now()): void {
  try {
    let k = key;
    if (!throttleState.has(k) && throttleState.size >= THROTTLE_MAX_KEYS) {
      for (const [old, st] of throttleState) {
        if (now - st.last >= windowMs && st.suppressed === 0) throttleState.delete(old);
      }
      if (throttleState.size >= THROTTLE_MAX_KEYS) k = "\u0000overflow";
    }
    const st = throttleState.get(k);
    if (st && now - st.last < windowMs) {
      st.suppressed++;
      return;
    }
    const suppressed = st?.suppressed ?? 0;
    throttleState.set(k, { last: now, suppressed: 0 });
    log(level, suppressed > 0 ? `${msg} suppressed=${suppressed}` : msg);
  } catch {
    // Logging never breaks the tool.
  }
}

/** Test hook: forget all throttle windows. */
export function resetThrottle(): void {
  throttleState.clear();
}
