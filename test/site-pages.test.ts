import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = join(__dirname, "..", "site");

function load(runs: unknown[]) {
  const dom = new JSDOM(readFileSync(join(SITE, "index.html"), "utf8"), { url: "http://x/", runScripts: "outside-only" });
  const w = dom.window as any;
  w.fetch = (u: string) =>
    u.endsWith("index.json")
      ? Promise.resolve({ ok: true, json: () => ({ runs }) })
      : Promise.resolve({ ok: false, status: 404 });
  w.eval(readFileSync(join(SITE, "config.js"), "utf8"));
  w.eval(readFileSync(join(SITE, "app.js"), "utf8"));
  return w as any;
}
const tick = () => new Promise((r) => setTimeout(r, 50));
const run = (o: Record<string, unknown>) => ({
  run_id: "r", date: "2026-10-09", kind: "weekly", n: 3, model: "opus", claude_code_version: "x",
  prereg: { version: "v2", sha256: "a".repeat(64) },
  nv: { mean: 0.04, lo: -0.03, hi: 0.11 }, q: { mean: 0, lo: 0, hi: 0 }, c: { mean: 0, lo: 0, hi: 0 },
  criteria: [{ id: "time", vanilla: 429981.33, cc: 457589, delta: { mean: 0.06, lo: -0.01, hi: 0.1 }, p_holm: 1, n: 3, raw_unit: "wall ms per pair (T1-T4)", direction: "lower_better", weight: 0.5 },
    { id: "tokens", vanilla: 387918.13, cc: 386766.2, delta: { mean: 0, lo: -0.06, hi: 0.1 }, p_holm: 1, n: 3, raw_unit: "weighted tokens per pair", direction: "lower_better", weight: 0.5 }],
  ...o,
});

describe("pages headline", () => {
  it("v1 run is never the headline; v2 pending, v1 labelled", async () => {
    const w = load([run({ prereg: { version: "v1", sha256: "b".repeat(64) } })]);
    await tick();
    const t = w.document.getElementById("headline-body").textContent;
    expect(t).toContain("First valid v2 run pending");
    expect(t).toContain("v1 — INCONCLUSIVE, treatment not received");
    expect(w.document.querySelector(".badge")?.textContent).toBe("PENDING");
  });
  it("v2 run without a valid field is NOT valid", async () => {
    const w = load([run({})]);
    await tick();
    expect(w.document.getElementById("headline-body").textContent).toContain("First valid v2 run pending");
    expect(w.BenchLogic.usable([run({})])).toHaveLength(0);
  });
  it("v2 valid:false or low treatment rate is excluded; valid:true is the headline", async () => {
    expect(w0().usable([run({ valid: false })])).toHaveLength(0);
    expect(w0().usable([run({ valid: true, treatment_received_rate: 0.3 })])).toHaveLength(0);
    const w = load([run({ valid: true, treatment_received_rate: 0.9 })]);
    await tick();
    expect(w.document.querySelector(".badge")?.textContent).toBe("INCONCLUSIVE");
  });
  it("formats time as minutes and tokens with separators, raw value in title", async () => {
    const w = load([run({ valid: true })]);
    await tick();
    const cells = [...w.document.querySelectorAll("#results-body td[title]")].map((c: any) => [c.textContent, c.getAttribute("title")]);
    expect(cells[0][0]).toBe("7.2 min");
    expect(cells[0][1]).toContain("429981.33");
    expect(cells[2][0]).toBe("387,918");
  });
});
function w0() {
  return load([]).BenchLogic;
}
