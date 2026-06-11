import { describe, it, expect } from "vitest";
import {
  displayWidth,
  progressBar,
  sparkline,
  sprintPulse,
  ticketDoneCard,
  phaseBanner,
  launchCard,
  sprintCompleteCard,
  type SprintPulseData,
  type TicketDoneData,
  type LaunchData,
  type CompleteData,
} from "../src/scrum/cards.js";

/** Total line width: 2-char diff prefix + 56 columns of content. */
const LINE_WIDTH = 58;

/** Representative, well-behaved pulse data (mirrors the spec's reference render). */
function makePulse(overrides: Partial<SprintPulseData> = {}): SprintPulseData {
  return {
    sprintName: "Sprint 22 — Close the Loop",
    day: 2,
    dayTotal: 5,
    donePoints: 9,
    totalPoints: 19,
    burndown: [19, 18, 16, 13, 9],
    counts: { done: 4, inProgress: 1, todo: 4, blocked: 0 },
    warnings: ["QA gate pending: T-232"],
    ...overrides,
  };
}

/** Assert the card-wide invariant: equal display width + legal diff prefixes on every line. */
function expectCardInvariant(card: string): void {
  const lines = card.split("\n");
  expect(lines.length).toBeGreaterThan(0);
  const widths = lines.map((l) => displayWidth(l));
  expect(new Set(widths).size).toBe(1);
  expect(widths[0]).toBe(LINE_WIDTH);
  for (const line of lines) {
    expect(["+ ", "- ", "  "]).toContain(line.slice(0, 2));
  }
}

describe("displayWidth", () => {
  it("counts plain ascii as 1 column per char", () => {
    expect(displayWidth("hello")).toBe(5);
    expect(displayWidth("T-231 (3pt)")).toBe(11);
  });

  it("counts the em-dash as width 1", () => {
    expect(displayWidth("—")).toBe(1);
    expect(displayWidth("Sprint 22 — Close the Loop")).toBe(26);
  });

  it("counts CJK and fullwidth chars as width 2", () => {
    expect(displayWidth("日本語")).toBe(6);
    expect(displayWidth("한")).toBe(2); // Hangul syllable
    expect(displayWidth("Ａ")).toBe(2); // fullwidth latin
    expect(displayWidth("\u{20000}")).toBe(2); // astral-plane CJK extension B
  });

  it("counts combining marks and zero-width joiners as 0", () => {
    expect(displayWidth("e\u0301")).toBe(1); // e + combining acute
    expect(displayWidth("a\u200Db")).toBe(2); // zero-width joiner
    expect(displayWidth("\uFE0F")).toBe(0); // variation selector
  });

  it("returns 0 for the empty string", () => {
    expect(displayWidth("")).toBe(0);
  });

  it("iterates by code point, not code unit (surrogate pairs)", () => {
    // U+20000 is 2 UTF-16 code units but one wide code point: width 2, not 4.
    expect(displayWidth("a\u{20000}b")).toBe(4);
  });
});

describe("progressBar", () => {
  it("renders all empty for total 0 (no division by zero)", () => {
    expect(progressBar(0, 0)).toBe("▱".repeat(16));
    expect(progressBar(5, 0)).toBe("▱".repeat(16));
  });

  it("renders all empty for 0/10", () => {
    expect(progressBar(0, 10)).toBe("▱".repeat(16));
  });

  it("renders all filled for 10/10", () => {
    expect(progressBar(10, 10)).toBe("▰".repeat(16));
  });

  it("clamps overflow 15/10 to all filled", () => {
    expect(progressBar(15, 10)).toBe("▰".repeat(16));
  });

  it("clamps negative done to all empty", () => {
    expect(progressBar(-3, 10)).toBe("▱".repeat(16));
  });

  it("respects a custom width", () => {
    expect(progressBar(1, 2, 8)).toBe("▰▰▰▰▱▱▱▱");
    expect(progressBar(3, 4, 4)).toBe("▰▰▰▱");
  });

  it("rounds proportionally (9/19 at default width = 8 filled)", () => {
    expect(progressBar(9, 19)).toBe("▰".repeat(8) + "▱".repeat(8));
  });
});

describe("sparkline", () => {
  it("renders an empty series as ·", () => {
    expect(sparkline([])).toBe("·");
  });

  it("renders a single value as ▁ (all-equal rule)", () => {
    expect(sparkline([5])).toBe("▁");
  });

  it("renders all zeros as all ▁", () => {
    expect(sparkline([0, 0, 0])).toBe("▁▁▁");
  });

  it("renders an all-equal series as all ▁", () => {
    expect(sparkline([4, 4, 4, 4])).toBe("▁▁▁▁");
  });

  it("maps an increasing series to a non-decreasing ramp ending in █", () => {
    expect(sparkline([1, 2, 3, 4, 5, 6, 7, 8])).toBe("▂▃▄▅▅▆▇█");
  });

  it("downsamples series longer than maxBuckets by averaging", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
    const line = sparkline(twenty);
    expect([...line]).toHaveLength(10); // default maxBuckets
    expect(line.endsWith("█")).toBe(true); // hottest bucket maps to the top glyph
    expect(sparkline(twenty, 5)).toHaveLength(5);
    // short series are not resampled
    expect([...sparkline([1, 9, 5])]).toHaveLength(3);
  });
});

describe("width invariant (every line equal width, legal diff prefixes)", () => {
  const awkwardTitles = [
    "Em—dash — heavy — title",
    "A very long ticket title that absolutely will not fit into fifty-six columns no matter how hard it tries",
    "Größenänderung der Benutzeroberfläche für Übersichten",
    "日本語のチケットタイトルが長すぎて切り詰めが必要になる",
  ];

  it("holds for ticketDoneCard across awkward titles, both QA states", () => {
    for (const title of awkwardTitles) {
      for (const qaVerified of [true, false]) {
        const card = ticketDoneCard({
          ref: "T-228",
          title,
          points: 5,
          agent: "fe-engineer",
          qaVerified,
          pulse: makePulse({ counts: { done: 4, inProgress: 1, todo: 4, blocked: 2 } }),
        });
        expectCardInvariant(card);
      }
    }
  });

  it("holds for sprintPulse with long umlaut/CJK names and overflowing warnings", () => {
    const card = sprintPulse(
      makePulse({
        sprintName: "Sprint 22 — Schließe die Schleife — 日本語のスプリント名",
        warnings: [
          "QA gate pending: T-232 — übergroße Warnung mit Diakritika äöüß and a very long tail 这是一个非常长的警告信息",
          "blocked: T-240",
        ],
      }),
    );
    expectCardInvariant(card);
  });

  it("holds for launchCard with a long wrapping goal (umlauts, em-dashes, CJK)", () => {
    const card = launchCard({
      sprintName: "Sprint 22 — Close the Loop — Übergröße",
      goal:
        "Schließe die Schleife — close the loop and light the terminal cockpit with gates, server-rendered cards und außerdem 日本語の目標テキスト that wraps across several lines",
      ticketCount: 5,
      points: 19,
      phase: "planning",
    });
    expectCardInvariant(card);
  });

  it("holds for sprintCompleteCard with awkward notes", () => {
    const card = sprintCompleteCard({
      sprintName: "Sprint 22 — Close the Loop",
      completed: 22,
      committed: 19,
      added: 3,
      ticketsDone: 5,
      ticketsTotal: 6,
      qaAllVerified: false,
      notes: [
        "carry-over — T-233 moved to Sprint 23 wegen Größenänderung der Schnittstelle 接口变更",
        "velocity über plan",
      ],
    });
    expectCardInvariant(card);
  });
});

describe("sprintPulse", () => {
  it("right-aligns day d/dT on the name line", () => {
    const lines = sprintPulse(makePulse()).split("\n");
    expect(lines[0].endsWith("day 2/5")).toBe(true);
    expect(lines[0]).toContain("Sprint 22 — Close the Loop");
  });

  it("omits the blocked segment when blocked is 0 and shows it when > 0", () => {
    const without = sprintPulse(makePulse({ warnings: [] }));
    expect(without).not.toContain("✗");
    expect(without).not.toContain("blocked");

    const withBlocked = sprintPulse(
      makePulse({ counts: { done: 4, inProgress: 1, todo: 4, blocked: 2 } }),
    );
    expect(withBlocked).toContain("✗ 2 blocked");
  });

  it("renders warnings as red ⚠ lines and truncates overlong ones", () => {
    const card = sprintPulse(
      makePulse({ warnings: ["short one", "x".repeat(120)] }),
    );
    const warningLines = card.split("\n").filter((l) => l.startsWith("- "));
    expect(warningLines).toHaveLength(2);
    expect(warningLines[0].startsWith("- ⚠ short one")).toBe(true);
    expect(warningLines[1]).toContain("…");
    expect(displayWidth(warningLines[1])).toBe(LINE_WIDTH);
  });

  it("renders bar, points and burndown sparkline on one line", () => {
    const lines = sprintPulse(makePulse()).split("\n");
    expect(lines[1]).toContain("▰".repeat(8) + "▱".repeat(8));
    expect(lines[1]).toContain("9/19 pt");
    expect(lines[1]).toContain(`burndown ${sparkline([19, 18, 16, 13, 9])}`);
  });
});

describe("ticketDoneCard", () => {
  it("uses + prefix and 'QA verified' when verified", () => {
    const card = ticketDoneCard({
      ref: "T-231",
      title: "Statusline HUD",
      points: 3,
      agent: "fe-engineer",
      qaVerified: true,
      pulse: makePulse(),
    });
    const lines = card.split("\n");
    // The spec's reference line is 57 columns; at the mandated 56 the title
    // gives up its last character so the meta segment stays intact.
    expect(lines[0]).toBe("+ ✓ T-231 Statusline H…  (3pt · fe-engineer · QA verified)");
    expect(lines[1]).toBe("  " + "─".repeat(56));
  });

  it("uses - prefix and '⚠ QA PENDING' when not verified", () => {
    const card = ticketDoneCard({
      ref: "T-232",
      title: "Loop gates",
      points: 5,
      agent: "be-engineer",
      qaVerified: false,
      pulse: makePulse(),
    });
    expect(card.split("\n")[0].startsWith("- ✓ T-232 Loop gates")).toBe(true);
    expect(card).toContain("⚠ QA PENDING");
  });

  it("truncates long titles but always keeps the meta segment intact", () => {
    const card = ticketDoneCard({
      ref: "T-228",
      title: "B1: Design Language 2.0 — server-rendered cards with an enormous descriptive suffix",
      points: 5,
      agent: "fe-engineer",
      qaVerified: true,
      pulse: makePulse(),
    });
    const first = card.split("\n")[0];
    expect(first).toContain("…");
    expect(first).toContain("(5pt · fe-engineer · QA verified)");
    expect(displayWidth(first)).toBe(LINE_WIDTH);
  });
});

describe("phaseBanner", () => {
  const fields = [
    { key: "Sprint", value: "Sprint 22 — Close the Loop" },
    { key: "Goal", value: "Ship loop gates", comment: "from kickoff" },
    { key: "Ticket Count", value: "5 (19pt)" },
    { key: "Gate", value: "green", comment: "all checks passed" },
  ];

  it("lowercases/underscores keys and aligns all values in one column", () => {
    const lines = phaseBanner("Phase 2 — Sprint Planning", fields).split("\n");
    expect(lines).toHaveLength(4);
    const starts = lines.map((l) => {
      const m = /^([a-z0-9_]+:)( +)/.exec(l);
      expect(m).not.toBeNull();
      return m![1].length + m![2].length;
    });
    expect(new Set(starts).size).toBe(1);
    expect(lines[2].startsWith("ticket_count:")).toBe(true);
  });

  it("aligns comments in one display column", () => {
    const lines = phaseBanner("Phase 2", fields).split("\n");
    const hashCols = lines
      .filter((l) => l.includes("#"))
      .map((l) => displayWidth(l.slice(0, l.indexOf("#"))));
    expect(hashCols).toHaveLength(2);
    expect(new Set(hashCols).size).toBe(1);
  });

  it("does not include the markdown heading or the title", () => {
    const banner = phaseBanner("Phase 2 — Sprint Planning", fields);
    expect(banner).not.toContain("◈");
    expect(banner).not.toContain("##");
    expect(banner).not.toContain("Phase 2");
  });

  it("truncates lines that exceed the width budget", () => {
    const banner = phaseBanner("t", [{ key: "Goal", value: "x".repeat(80) }]);
    expect(banner.split("\n")).toHaveLength(1);
    expect(displayWidth(banner)).toBeLessThanOrEqual(56);
    expect(banner.endsWith("…")).toBe(true);
  });
});

describe("launchCard", () => {
  it("renders header, ticket and phase lines", () => {
    const d: LaunchData = {
      sprintName: "Sprint 22 — Close the Loop",
      goal: "Close the loop",
      ticketCount: 5,
      points: 19,
      phase: "planning",
    };
    const card = launchCard(d);
    const lines = card.split("\n");
    expect(lines[0].startsWith("+ ✦ SPRINT STARTED — Sprint 22 — Close the Loop")).toBe(true);
    expect(card).toContain("tickets: 5 (19pt)");
    expect(card).toContain("phase: planning");
  });

  it("word-wraps a long goal across multiple neutral lines", () => {
    const card = launchCard({
      sprintName: "S22",
      goal:
        "Close the loop and light the terminal cockpit with loop gates and server-rendered cards so ceremonies stay cheap",
      ticketCount: 5,
      points: 19,
      phase: "planning",
    });
    const lines = card.split("\n");
    // header + >=2 goal lines + tickets + phase
    expect(lines.length).toBeGreaterThanOrEqual(5);
    const goalLines = lines.slice(1, -2);
    expect(goalLines.length).toBeGreaterThanOrEqual(2);
    for (const line of goalLines) {
      expect(line.startsWith("  ")).toBe(true);
    }
  });
});

describe("sprintCompleteCard", () => {
  const base: CompleteData = {
    sprintName: "Sprint 22 — Close the Loop",
    completed: 19,
    committed: 19,
    ticketsDone: 5,
    ticketsTotal: 5,
    qaAllVerified: true,
  };

  it("renders velocity without the added segment when nothing was added", () => {
    const card = sprintCompleteCard(base);
    expect(card).toContain("velocity: 19/19 pt");
    expect(card).not.toContain("added");
  });

  it("appends (+N added) when points were added mid-sprint", () => {
    const card = sprintCompleteCard({ ...base, completed: 22, added: 3 });
    expect(card).toContain("velocity: 22/19 pt (+3 added)");
  });

  it("renders the QA line green when all verified, red otherwise", () => {
    expect(sprintCompleteCard(base)).toContain("+ ✓ QA all verified");
    const incomplete = sprintCompleteCard({ ...base, qaAllVerified: false });
    expect(incomplete).toContain("- ⚠ QA incomplete");
    expect(incomplete).not.toContain("QA all verified");
  });

  it("renders notes as neutral bullet lines", () => {
    const card = sprintCompleteCard({ ...base, notes: ["retro on Friday", "demo recorded"] });
    expect(card).toContain("· retro on Friday");
    expect(card).toContain("· demo recorded");
    expect(card).toContain("tickets: 5/5 done");
  });
});

describe("snapshots (one representative render per card type)", () => {
  it("ticketDoneCard", () => {
    const d: TicketDoneData = {
      ref: "T-231",
      title: "Statusline HUD",
      points: 3,
      agent: "fe-engineer",
      qaVerified: true,
      pulse: makePulse(),
    };
    expect(ticketDoneCard(d)).toMatchInlineSnapshot(`
      "+ ✓ T-231 Statusline H…  (3pt · fe-engineer · QA verified)
        ────────────────────────────────────────────────────────
        Sprint 22 — Close the Loop                       day 2/5
        ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  9/19 pt                 burndown ██▇▆▄
        ✓ 4 done   ⚙ 1 in progress   ○ 4 todo                   
      - ⚠ QA gate pending: T-232                                "
    `);
  });

  it("sprintPulse", () => {
    expect(sprintPulse(makePulse())).toMatchInlineSnapshot(`
      "  Sprint 22 — Close the Loop                       day 2/5
        ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  9/19 pt                 burndown ██▇▆▄
        ✓ 4 done   ⚙ 1 in progress   ○ 4 todo                   
      - ⚠ QA gate pending: T-232                                "
    `);
  });

  it("phaseBanner", () => {
    expect(
      phaseBanner("Phase 2 — Sprint Planning", [
        { key: "Sprint", value: "Sprint 22 — Close the Loop" },
        { key: "Goal", value: "Ship loop gates", comment: "from kickoff" },
        { key: "Ticket Count", value: "5 (19pt)" },
        { key: "Gate", value: "green", comment: "all checks passed" },
      ]),
    ).toMatchInlineSnapshot(`
      "sprint:       Sprint 22 — Close the Loop
      goal:         Ship loop gates  # from kickoff
      ticket_count: 5 (19pt)
      gate:         green            # all checks passed"
    `);
  });

  it("launchCard", () => {
    expect(
      launchCard({
        sprintName: "Sprint 22 — Close the Loop",
        goal: "Close the loop and light the terminal cockpit",
        ticketCount: 5,
        points: 19,
        phase: "planning",
      }),
    ).toMatchInlineSnapshot(`
      "+ ✦ SPRINT STARTED — Sprint 22 — Close the Loop           
        Close the loop and light the terminal cockpit           
        tickets: 5 (19pt)                                       
        phase: planning                                         "
    `);
  });

  it("sprintCompleteCard", () => {
    expect(
      sprintCompleteCard({
        sprintName: "Sprint 22 — Close the Loop",
        completed: 22,
        committed: 19,
        added: 3,
        ticketsDone: 5,
        ticketsTotal: 6,
        qaAllVerified: false,
        notes: ["T-233 carried over to Sprint 23"],
      }),
    ).toMatchInlineSnapshot(`
      "+ ✦ SPRINT COMPLETE — Sprint 22 — Close the Loop          
        velocity: 22/19 pt (+3 added)                           
        tickets: 5/6 done                                       
      - ⚠ QA incomplete                                         
        · T-233 carried over to Sprint 23                       "
    `);
  });
});
