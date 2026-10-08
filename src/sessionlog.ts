// Overdrive session log — one shared, append-only breadcrumb file per Claude
// Code session, written by every local tool (contract: overdrive SESSION-LOG.md).
//
//   <ts>\t<LEVEL>\tcode-context@<version>\tpid=<pid>\t<message>
//
// Rules this helper enforces:
// - stdout is the MCP stdio transport: never print anything, ever.
// - one fs.writeSync per line on an fd opened with 'a' (O_APPEND), so lines
//   from concurrent writers never interleave and survive a crash.
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
    const fd = fs.openSync(file, "a", 0o600);
    try {
      fs.writeSync(fd, line);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // Logging never breaks the tool.
  }
}

/**
 * Patch `server.tool(name, ..., handler)` so every handler registered from now
 * on logs a CRITICAL line (tool name + error class) when it throws, then
 * rethrows unchanged — the MCP SDK still turns it into its usual error result.
 * Call before any tool is registered.
 */
export function logToolExceptions(server: { tool: (...args: never[]) => unknown }): void {
  const target = server as unknown as { tool: (...args: unknown[]) => unknown };
  const register = target.tool.bind(server);
  target.tool = (...args: unknown[]) => {
    const name = String(args[0]);
    const handler = args[args.length - 1];
    if (typeof handler === "function") {
      args[args.length - 1] = async (...callArgs: unknown[]) => {
        try {
          return await (handler as (...a: unknown[]) => unknown)(...callArgs);
        } catch (err) {
          log("CRITICAL", `tool ${name}: unhandled exception error=${errorClass(err)}`);
          throw err;
        }
      };
    }
    return register(...args);
  };
}
