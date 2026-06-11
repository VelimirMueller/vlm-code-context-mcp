/**
 * Design Language 2.0 — server-rendered scrum cards (spec B1, Sprint 22).
 *
 * Pure, dependency-free rendering helpers for terminal cards. Every card is a
 * newline-joined block of lines designed to be printed verbatim inside a
 * GitHub-flavored-markdown ```diff fence, where Claude Code's renderer colors
 * the line prefixes:
 *
 *   "+ "  positive (green)  — done, passed, launched
 *   "- "  warning  (red)    — blocked, QA pending, escalated
 *   "  "  neutral           — everything else
 *
 * Layout contract: after the 2-character diff prefix, every line carries
 * exactly 56 display columns of content. Long values are truncated with a
 * trailing "…" (or word-wrapped where documented per field) and short lines
 * are padded with trailing spaces, so every line of a card renders at an
 * identical display width. Aligned regions use only verified single-width
 * glyphs (▰ ▱ ▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ✓ ⚙ ○ ◈ ✦ ⚠ ✗ ─ ·) — never emoji, since
 * double-width emoji shear column alignment.
 *
 * The one exception is {@link phaseBanner}, which renders a yaml-flavored
 * data block (for a ```yaml fence) instead of diff-prefixed lines.
 */

/** Inner content width (display columns) of every card line, after the 2-char diff prefix. */
const INNER_WIDTH = 56;

/** The three legal diff-fence line prefixes: positive, warning, neutral. */
type DiffPrefix = "+ " | "- " | "  ";

/** Sparkline glyph ramp, lowest to highest. */
const SPARK_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** Bar glyphs for {@link progressBar}. */
const BAR_FILLED = "▰";
const BAR_EMPTY = "▱";

/**
 * Display width of a single Unicode code point in terminal columns.
 *
 * - 0 for combining diacritics (U+0300–U+036F), zero-width space/joiners
 *   (U+200B–U+200D) and variation selectors (U+FE00–U+FE0F).
 * - 2 for CJK/wide ranges: U+1100–U+115F, U+2E80–U+A4CF, U+AC00–U+D7A3,
 *   U+F900–U+FAFF, U+FE30–U+FE4F, U+FF00–U+FF60, U+FFE0–U+FFE6, and the
 *   astral plane from U+20000 upward.
 * - 1 for everything else.
 */
function codePointWidth(cp: number): 0 | 1 | 2 {
  if (
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
    (cp >= 0x200b && cp <= 0x200d) || // zero-width space / non-joiner / joiner
    (cp >= 0xfe00 && cp <= 0xfe0f) //    variation selectors
  ) {
    return 0;
  }
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK radicals … Yi syllables
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) || // fullwidth signs
    cp >= 0x20000 //                     astral-plane CJK extensions and beyond
  ) {
    return 2;
  }
  return 1;
}

/**
 * Count the terminal display columns of a string.
 *
 * Iterates by Unicode code point (never by UTF-16 code unit), treating CJK
 * and other wide ranges as 2 columns and combining marks / zero-width
 * joiners / variation selectors as 0 columns; everything else counts 1.
 * See {@link codePointWidth} for the exact ranges.
 *
 * @param s - The string to measure.
 * @returns Number of display columns the string occupies in a terminal.
 */
export function displayWidth(s: string): number {
  let width = 0;
  for (const ch of s) {
    width += codePointWidth(ch.codePointAt(0)!);
  }
  return width;
}

/**
 * Truncate a string to at most `max` display columns, appending a trailing
 * "…" (1 column) when anything was cut. Strings that already fit are
 * returned unchanged. Truncation walks code points, so a wide glyph that
 * would straddle the limit is dropped entirely.
 */
function truncateDisplay(s: string, max: number): string {
  if (displayWidth(s) <= max) return s;
  if (max <= 0) return "";
  const budget = max - 1; // reserve one column for the ellipsis
  let out = "";
  let used = 0;
  for (const ch of s) {
    const w = codePointWidth(ch.codePointAt(0)!);
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  return `${out}…`;
}

/** Pad `s` with trailing spaces up to `width` display columns (no-op if already wider). */
function padDisplay(s: string, width: number): string {
  const gap = width - displayWidth(s);
  return gap > 0 ? s + " ".repeat(gap) : s;
}

/**
 * Compose one line of exactly `width` display columns with `left` anchored at
 * the start and `right` anchored at the end (the "label left, value right"
 * helper). `left` is truncated to preserve at least a 2-column gap; in the
 * degenerate case where `right` alone (nearly) fills the line, the joined
 * string is simply truncated.
 */
function lineLR(left: string, right: string, width: number): string {
  const rightW = displayWidth(right);
  if (rightW + 3 > width) {
    return truncateDisplay(`${left}  ${right}`, width);
  }
  const leftMax = width - rightW - 2;
  const leftFit = displayWidth(left) > leftMax ? truncateDisplay(left, leftMax) : left;
  return leftFit + " ".repeat(width - displayWidth(leftFit) - rightW) + right;
}

/**
 * Build one finished card line: diff prefix + content truncated to the inner
 * width and padded with trailing spaces to exactly {@link INNER_WIDTH}
 * columns. Every diff-card line in this module goes through here, which is
 * what enforces the equal-width invariant.
 */
function cardLine(prefix: DiffPrefix, content: string): string {
  return prefix + padDisplay(truncateDisplay(content, INNER_WIDTH), INNER_WIDTH);
}

/**
 * Greedy word-wrap by display width. Words longer than `width` are
 * hard-broken at code-point boundaries. Whitespace runs collapse to single
 * spaces; an all-whitespace input yields no lines.
 */
function wrapDisplay(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    let word = w;
    while (displayWidth(word) > width) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let head = "";
      let used = 0;
      for (const ch of word) {
        const cw = codePointWidth(ch.codePointAt(0)!);
        if (used + cw > width) break;
        head += ch;
        used += cw;
      }
      lines.push(head);
      word = word.slice(head.length);
    }
    if (word.length === 0) continue;
    if (!current) {
      current = word;
    } else if (displayWidth(current) + 1 + displayWidth(word) <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render a progress bar of filled (▰) and empty (▱) cells.
 *
 * `done` is clamped to the range [0, total]; the filled cell count is the
 * rounded proportion of `width`. A non-positive `total` renders an all-empty
 * bar (no division by zero).
 *
 * @param done - Completed amount (clamped to [0, total]).
 * @param total - Total amount; `<= 0` renders all ▱.
 * @param width - Bar width in cells (default 16, floored, minimum 0).
 * @returns Only the bar glyphs — exactly `width` characters, no padding or labels.
 */
export function progressBar(done: number, total: number, width = 16): string {
  const cells = Math.max(0, Math.floor(width));
  if (total <= 0) return BAR_EMPTY.repeat(cells);
  const clamped = Math.min(Math.max(done, 0), total);
  const filled = Math.round((clamped / total) * cells);
  return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(cells - filled);
}

/**
 * Render a series as a sparkline using ▁▂▃▄▅▆▇█, normalized against the
 * maximum value (a value equal to the max renders █, zero renders ▁;
 * negative values clamp to ▁).
 *
 * Special cases: an empty array returns "·"; an all-equal or all-zero (or
 * all-negative) series renders all ▁. Series longer than `maxBuckets` are
 * downsampled by splitting into `maxBuckets` buckets and averaging each, so
 * the output never exceeds `maxBuckets` glyphs.
 *
 * @param values - The series to render (e.g. burndown of remaining points).
 * @param maxBuckets - Maximum number of output glyphs (default 10, minimum 1).
 * @returns Sparkline glyph string, or "·" for an empty series.
 */
export function sparkline(values: number[], maxBuckets = 10): string {
  if (values.length === 0) return "·";
  const buckets = Math.max(1, Math.floor(maxBuckets));
  let series = values;
  if (values.length > buckets) {
    series = [];
    const size = values.length / buckets;
    for (let i = 0; i < buckets; i++) {
      const start = Math.floor(i * size);
      const end = Math.max(start + 1, Math.floor((i + 1) * size));
      const slice = values.slice(start, end);
      series.push(slice.reduce((sum, v) => sum + v, 0) / slice.length);
    }
  }
  const max = Math.max(...series);
  const min = Math.min(...series);
  if (max <= 0 || min === max) return SPARK_GLYPHS[0].repeat(series.length);
  const top = SPARK_GLYPHS.length - 1;
  return series
    .map((v) => {
      const idx = Math.round((Math.max(v, 0) / max) * top);
      return SPARK_GLYPHS[Math.min(top, Math.max(0, idx))];
    })
    .join("");
}

/** Ticket counts by status for a sprint pulse block. */
export interface TicketCounts {
  /** Tickets in DONE. */
  done: number;
  /** Tickets in IN_PROGRESS. */
  inProgress: number;
  /** Tickets in TODO. */
  todo: number;
  /** Tickets in BLOCKED. */
  blocked: number;
}

/** Data for {@link sprintPulse}. */
export interface SprintPulseData {
  /** Sprint display name. */
  sprintName: string;
  /** Current sprint day (1-based). */
  day: number;
  /** Total days in the sprint. */
  dayTotal: number;
  /** Story points completed so far. */
  donePoints: number;
  /** Story points committed in total. */
  totalPoints: number;
  /** Burndown series (e.g. remaining points per day) for the sparkline. */
  burndown: number[];
  /** Ticket counts by status. */
  counts: TicketCounts;
  /** Optional warning messages, each rendered as a red "- ⚠ …" line. */
  warnings?: string[];
}

/**
 * Render the sprint pulse block — the shared "state of the sprint" footer.
 *
 * Lines (all 56 columns after the diff prefix):
 * 1. neutral — sprint name (truncated with "…" if needed) left, "day d/dT"
 *    right-aligned.
 * 2. neutral — progress bar + "X/Y pt" left, "burndown <sparkline>"
 *    right-aligned.
 * 3. neutral — "✓ N done   ⚙ N in progress   ○ N todo", plus "✗ N blocked"
 *    only when blocked > 0 (truncated if pathological counts overflow).
 * 4. one warning line per entry, "- ⚠ <text>", truncated with "…" to fit.
 *
 * @returns Newline-joined diff-prefixed lines (no trailing newline).
 */
export function sprintPulse(d: SprintPulseData): string {
  const lines: string[] = [];
  lines.push(cardLine("  ", lineLR(d.sprintName, `day ${d.day}/${d.dayTotal}`, INNER_WIDTH)));

  const bar = progressBar(d.donePoints, d.totalPoints);
  const points = `${bar}  ${d.donePoints}/${d.totalPoints} pt`;
  const trend = `burndown ${sparkline(d.burndown)}`;
  lines.push(cardLine("  ", lineLR(points, trend, INNER_WIDTH)));

  const c = d.counts;
  let counts = `✓ ${c.done} done   ⚙ ${c.inProgress} in progress   ○ ${c.todo} todo`;
  if (c.blocked > 0) counts += `   ✗ ${c.blocked} blocked`;
  lines.push(cardLine("  ", counts));

  for (const warning of d.warnings ?? []) {
    lines.push(cardLine("- ", `⚠ ${warning}`));
  }
  return lines.join("\n");
}

/** Data for {@link ticketDoneCard}. */
export interface TicketDoneData {
  /** Ticket reference, e.g. "T-231". */
  ref: string;
  /** Ticket title (truncated with "…" to keep the meta segment intact). */
  title: string;
  /** Story points. */
  points: number;
  /** Agent/role that completed the ticket. */
  agent: string;
  /** Whether QA has verified the ticket. */
  qaVerified: boolean;
  /** Sprint pulse rendered below the separator. */
  pulse: SprintPulseData;
}

/**
 * Render the ticket-completion card.
 *
 * First line: "✓ <ref> <title>  (<points>pt · <agent> · QA verified)" with a
 * green "+ " prefix — or, when QA is pending, a red "- " prefix and
 * "⚠ QA PENDING" in the meta segment. The title is truncated with "…" so the
 * meta segment always survives. Then a neutral full-width "─" separator line
 * and the {@link sprintPulse} block.
 *
 * @returns Newline-joined diff-prefixed lines (no trailing newline).
 */
export function ticketDoneCard(d: TicketDoneData): string {
  const qa = d.qaVerified ? "QA verified" : "⚠ QA PENDING";
  const lead = `✓ ${d.ref} `;
  const tail = `  (${d.points}pt · ${d.agent} · ${qa})`;
  const titleBudget = INNER_WIDTH - displayWidth(lead) - displayWidth(tail);
  const title = truncateDisplay(d.title, Math.max(1, titleBudget));
  const prefix: DiffPrefix = d.qaVerified ? "+ " : "- ";
  return [
    cardLine(prefix, `${lead}${title}${tail}`),
    cardLine("  ", "─".repeat(INNER_WIDTH)),
    sprintPulse(d.pulse),
  ].join("\n");
}

/** One key/value row of a {@link phaseBanner}, with an optional trailing comment. */
export interface PhaseField {
  /** Field label; normalized to lowercase_underscored yaml style. */
  key: string;
  /** Field value, printed verbatim (truncated only if the line overflows). */
  value: string;
  /** Optional comment, rendered as "  # <comment>" in an aligned column. */
  comment?: string;
}

/**
 * Render a phase banner data block, yaml-flavored for a ```yaml fence.
 *
 * NOTE: the markdown heading "## ◈ <title>" is NOT part of the return value —
 * callers print that heading themselves; `title` is accepted here so banner
 * call sites carry the full banner contract in one place. The return value is
 * only the data block.
 *
 * Unlike the diff cards, lines carry no diff prefixes and are not padded to a
 * fixed width. Alignment rules:
 * - keys are lowercased and non-alphanumeric runs become "_"; "<key>:" is
 *   padded so all values start in the same column.
 * - rows with a comment have their value padded so every "  # <comment>"
 *   starts in the same display column.
 * - any line that would exceed the 56-column budget is truncated with "…".
 *
 * @returns Newline-joined yaml-style lines (empty string for no fields).
 */
export function phaseBanner(title: string, fields: PhaseField[]): string {
  const rows = fields.map((f) => ({
    key: normalizeKey(f.key),
    value: f.value,
    comment: f.comment,
  }));
  const keyW = Math.max(0, ...rows.map((r) => r.key.length + 1));
  const commentValueW = Math.max(
    0,
    ...rows.filter((r) => r.comment !== undefined).map((r) => displayWidth(r.value)),
  );
  return rows
    .map((r) => {
      const head = `${padDisplay(`${r.key}:`, keyW)} `;
      const body =
        r.comment !== undefined
          ? `${padDisplay(r.value, commentValueW)}  # ${r.comment}`
          : r.value;
      return truncateDisplay(head + body, INNER_WIDTH);
    })
    .join("\n");
}

/** Lowercase a label and collapse non-alphanumeric runs to "_" (yaml-style key). */
function normalizeKey(key: string): string {
  const normalized = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "field";
}

/** Data for {@link launchCard}. */
export interface LaunchData {
  /** Sprint display name. */
  sprintName: string;
  /** Sprint goal; word-wrapped across as many neutral lines as needed. */
  goal: string;
  /** Number of tickets committed. */
  ticketCount: number;
  /** Story points committed. */
  points: number;
  /** Phase the sprint starts in, e.g. "planning". */
  phase: string;
}

/**
 * Render the sprint-launch card.
 *
 * "+ ✦ SPRINT STARTED — <name>" (name truncated with "…" if needed), then
 * neutral lines: the goal word-wrapped to the card width (multi-line ok,
 * omitted entirely when blank), "tickets: N (Ppt)", and "phase: <phase>".
 *
 * @returns Newline-joined diff-prefixed lines (no trailing newline).
 */
export function launchCard(d: LaunchData): string {
  const lines: string[] = [cardLine("+ ", `✦ SPRINT STARTED — ${d.sprintName}`)];
  for (const goalLine of wrapDisplay(d.goal, INNER_WIDTH)) {
    lines.push(cardLine("  ", goalLine));
  }
  lines.push(cardLine("  ", `tickets: ${d.ticketCount} (${d.points}pt)`));
  lines.push(cardLine("  ", `phase: ${d.phase}`));
  return lines.join("\n");
}

/** Data for {@link sprintCompleteCard}. */
export interface CompleteData {
  /** Sprint display name. */
  sprintName: string;
  /** Story points completed. */
  completed: number;
  /** Story points originally committed. */
  committed: number;
  /** Points added mid-sprint; shown as "(+N added)" when > 0. */
  added?: number;
  /** Tickets finished. */
  ticketsDone: number;
  /** Tickets total. */
  ticketsTotal: number;
  /** Whether every DONE ticket passed QA verification. */
  qaAllVerified: boolean;
  /** Optional closing notes, one neutral "· <note>" line each (truncated). */
  notes?: string[];
}

/**
 * Render the sprint-completion card.
 *
 * "+ ✦ SPRINT COMPLETE — <name>", a neutral velocity line
 * "velocity: <completed>/<committed> pt" (plus " (+N added)" when points were
 * added mid-sprint), a neutral "tickets: D/T done" line, then a green
 * "+ ✓ QA all verified" or red "- ⚠ QA incomplete" line, and finally one
 * neutral "· <note>" line per note (each truncated with "…" to fit).
 *
 * @returns Newline-joined diff-prefixed lines (no trailing newline).
 */
export function sprintCompleteCard(d: CompleteData): string {
  const lines: string[] = [cardLine("+ ", `✦ SPRINT COMPLETE — ${d.sprintName}`)];
  let velocity = `velocity: ${d.completed}/${d.committed} pt`;
  if (d.added) velocity += ` (+${d.added} added)`;
  lines.push(cardLine("  ", velocity));
  lines.push(cardLine("  ", `tickets: ${d.ticketsDone}/${d.ticketsTotal} done`));
  lines.push(
    d.qaAllVerified ? cardLine("+ ", "✓ QA all verified") : cardLine("- ", "⚠ QA incomplete"),
  );
  for (const note of d.notes ?? []) {
    lines.push(cardLine("  ", `· ${note}`));
  }
  return lines.join("\n");
}
