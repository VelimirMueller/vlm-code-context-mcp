import { describe, test, expect } from "vitest";
import { parseExports, extractJSDocBefore } from "../src/server/indexer";

// ─── extractJSDocBefore ─────────────────────────────────────────────────────

describe("extractJSDocBefore", () => {
  test("extracts single-line JSDoc description", () => {
    const content = `/** Does something cool. */\nexport function foo() {}`;
    expect(extractJSDocBefore(content, content.indexOf("export"))).toBe("Does something cool.");
  });

  test("extracts multi-line JSDoc, joins non-tag lines", () => {
    const content = [
      "/** ",
      " * Fetches data from the API.",
      " * Returns a promise.",
      " * @param url - the endpoint",
      " * @returns response data",
      " */",
      "export async function fetchData() {}",
    ].join("\n");
    expect(extractJSDocBefore(content, content.indexOf("export"))).toBe(
      "Fetches data from the API. Returns a promise."
    );
  });

  test("returns null when no JSDoc precedes the position", () => {
    const content = `// regular comment\nexport function foo() {}`;
    expect(extractJSDocBefore(content, content.indexOf("export"))).toBeNull();
  });

  test("returns null for empty JSDoc", () => {
    const content = `/** */\nexport function foo() {}`;
    expect(extractJSDocBefore(content, content.indexOf("export"))).toBeNull();
  });

  test("returns null for JSDoc with only tags", () => {
    const content = `/** @param x - value */\nexport function foo() {}`;
    expect(extractJSDocBefore(content, content.indexOf("export"))).toBeNull();
  });
});

// ─── parseExports: default exports ──────────────────────────────────────────

describe("parseExports — default exports", () => {
  test("parses export default function", () => {
    const result = parseExports(`export default function App() {}`);
    expect(result).toEqual([
      { name: "App", kind: "function", description: null },
    ]);
  });

  test("parses export default class", () => {
    const result = parseExports(`export default class Widget {}`);
    expect(result).toEqual([
      { name: "Widget", kind: "class", description: null },
    ]);
  });

  test("attaches JSDoc to default export", () => {
    const content = `/** The main app. */\nexport default function App() {}`;
    const result = parseExports(content);
    expect(result[0].description).toBe("The main app.");
  });
});

// ─── parseExports: named exports ────────────────────────────────────────────

describe("parseExports — named exports", () => {
  test("parses exported function", () => {
    const result = parseExports(`export function hello() {}`);
    expect(result).toContainEqual({ name: "hello", kind: "function", description: null });
  });

  test("parses exported async function", () => {
    const result = parseExports(`export async function fetchData() {}`);
    expect(result).toContainEqual({ name: "fetchData", kind: "function", description: null });
  });

  test("parses exported const", () => {
    const result = parseExports(`export const MAX = 10;`);
    expect(result).toContainEqual({ name: "MAX", kind: "const", description: null });
  });

  test("normalizes let to const", () => {
    const result = parseExports(`export let counter = 0;`);
    expect(result).toContainEqual({ name: "counter", kind: "const", description: null });
  });

  test("normalizes var to const", () => {
    const result = parseExports(`export var legacy = true;`);
    expect(result).toContainEqual({ name: "legacy", kind: "const", description: null });
  });

  test("parses exported class", () => {
    const result = parseExports(`export class Foo {}`);
    expect(result).toContainEqual({ name: "Foo", kind: "class", description: null });
  });

  test("parses exported interface", () => {
    const result = parseExports(`export interface Bar {}`);
    expect(result).toContainEqual({ name: "Bar", kind: "interface", description: null });
  });

  test("parses exported type", () => {
    const result = parseExports(`export type ID = string;`);
    expect(result).toContainEqual({ name: "ID", kind: "type", description: null });
  });

  test("parses exported enum", () => {
    const result = parseExports(`export enum Status { A, B }`);
    expect(result).toContainEqual({ name: "Status", kind: "enum", description: null });
  });

  test("attaches JSDoc to named export", () => {
    const content = `/** The limit. */\nexport const LIMIT = 100;`;
    const result = parseExports(content);
    expect(result).toContainEqual({ name: "LIMIT", kind: "const", description: "The limit." });
  });
});

// ─── parseExports: re-exports ───────────────────────────────────────────────

describe("parseExports — re-exports", () => {
  test("parses local re-export", () => {
    const result = parseExports(`export { foo, bar }`);
    expect(result).toContainEqual({ name: "foo", kind: "re-export", description: null });
    expect(result).toContainEqual({ name: "bar", kind: "re-export", description: null });
  });

  test("parses re-export from module (uses alias name)", () => {
    const result = parseExports(`export { foo as myFoo } from './mod'`);
    expect(result).toContainEqual({ name: "myFoo", kind: "re-export", description: null });
  });

  test("parses re-export from module (no alias uses original name)", () => {
    const result = parseExports(`export { bar } from './mod'`);
    expect(result).toContainEqual({ name: "bar", kind: "re-export", description: null });
  });

  test("re-exports have null description", () => {
    const result = parseExports(`export { a } from './x'`);
    expect(result.every((e) => e.description === null)).toBe(true);
  });
});

// ─── parseExports: mixed content ────────────────────────────────────────────

describe("parseExports — mixed content", () => {
  test("extracts all export types from realistic file", () => {
    const content = [
      `/** Utility helpers. */`,
      `export function helper() {}`,
      ``,
      `export const VERSION = "1.0";`,
      `export type Config = { key: string };`,
      `export { helper as default }`,
      `export { readFile } from 'fs'`,
    ].join("\n");

    const result = parseExports(content);
    const names = result.map((e) => e.name);

    expect(names).toContain("helper");
    expect(names).toContain("VERSION");
    expect(names).toContain("Config");
    expect(names).toContain("helper"); // local re-export
    expect(names).toContain("readFile"); // from re-export
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});
