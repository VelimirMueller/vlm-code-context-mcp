import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveDashboardToken,
  extractRequestToken,
  isPublicPath,
  tokensMatch,
  isAuthorized,
} from "../src/dashboard/auth.js";

const ENV = "CODE_CONTEXT_DASHBOARD_TOKEN";
const prevEnv = process.env[ENV];
afterEach(() => {
  if (prevEnv === undefined) delete process.env[ENV];
  else process.env[ENV] = prevEnv;
});

describe("dashboard auth: resolveDashboardToken (#15b)", () => {
  it("returns the env token when set, without writing a file", () => {
    process.env[ENV] = "env-token-123";
    const root = mkdtempSync(path.join(tmpdir(), "cc-auth-"));
    try {
      expect(resolveDashboardToken(root)).toBe("env-token-123");
      expect(existsSync(path.join(root, ".code-context/dashboard.token"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates and persists a token (gitignored) when none exists", () => {
    delete process.env[ENV];
    const root = mkdtempSync(path.join(tmpdir(), "cc-auth-"));
    try {
      const t = resolveDashboardToken(root);
      expect(t.length).toBeGreaterThanOrEqual(32);
      const file = path.join(root, ".code-context/dashboard.token");
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, "utf-8").trim()).toBe(t);
      expect(existsSync(path.join(root, ".code-context/.gitignore"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns the same persisted token on a second call", () => {
    delete process.env[ENV];
    const root = mkdtempSync(path.join(tmpdir(), "cc-auth-"));
    try {
      expect(resolveDashboardToken(root)).toBe(resolveDashboardToken(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("dashboard auth: token extraction + matching", () => {
  it("extracts a Bearer token from the Authorization header", () => {
    const req = { headers: { authorization: "Bearer abc123" } };
    expect(extractRequestToken(req, new URL("http://localhost/api/x"))).toBe("abc123");
  });
  it("extracts a token from ?token= (for EventSource, which can't set headers)", () => {
    expect(
      extractRequestToken({ headers: {} }, new URL("http://localhost/api/events?token=xyz")),
    ).toBe("xyz");
  });
  it("returns null when no token is present", () => {
    expect(extractRequestToken({ headers: {} }, new URL("http://localhost/api/x"))).toBeNull();
  });
  it("matches equal tokens and rejects mismatches and length differences", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abc", "abd")).toBe(false);
    expect(tokensMatch("abc", "abcd")).toBe(false);
    expect(tokensMatch(null, "abc")).toBe(false);
  });
});

describe("dashboard auth: authorization decisions", () => {
  const TOKEN = "secret-token";
  it("treats non-/api paths (page, assets, SPA routes) as public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/assets/index-abc.js")).toBe(true);
    expect(isPublicPath("/some/spa/route")).toBe(true);
    expect(isPublicPath("/api/sprints")).toBe(false);
    expect(isPublicPath("/api/events")).toBe(false);
  });
  it("allows public paths without a token", () => {
    expect(isAuthorized({ headers: {} }, new URL("http://localhost/"), TOKEN)).toBe(true);
  });
  it("rejects /api without a token", () => {
    expect(isAuthorized({ headers: {} }, new URL("http://localhost/api/sprints"), TOKEN)).toBe(false);
  });
  it("allows /api with the correct Bearer token", () => {
    const req = { headers: { authorization: `Bearer ${TOKEN}` } };
    expect(isAuthorized(req, new URL("http://localhost/api/sprints"), TOKEN)).toBe(true);
  });
  it("allows /api/events with the correct ?token", () => {
    expect(
      isAuthorized({ headers: {} }, new URL(`http://localhost/api/events?token=${TOKEN}`), TOKEN),
    ).toBe(true);
  });
  it("rejects /api with a wrong token", () => {
    const req = { headers: { authorization: "Bearer nope" } };
    expect(isAuthorized(req, new URL("http://localhost/api/sprints"), TOKEN)).toBe(false);
  });
});
