/**
 * Live bench task set (PLAN.md task 6).
 *
 * Three small tasks against test/fixtures/sample-project. Each task pairs a
 * prompt (what the agent sees) with a deterministic checker (what the bench
 * believes). Hidden check files under scripts/bench/live/checks/ are never
 * shown to the agent.
 *
 * L1 is the smallest task — `npm run bench:live -- --tasks L1` runs just it.
 */

export type CheckerSpec =
  | {
      /** Final assistant answer must match every pattern after normalisation. */
      type: 'answer';
      answerMustMatch: string[];
    }
  | {
      /** A workspace file must export the symbol and the barrel must re-export it. */
      type: 'symbol';
      symbol: string;
      barrel: string;
    }
  | {
      /** Copy the hidden vitest file into the workspace and run it (exit 0 = pass). */
      type: 'tests';
      checkFile: string;
    };

export interface LiveTask {
  id: string;
  prompt: string;
  checker: CheckerSpec;
}

export const LIVE_TASKS: LiveTask[] = [
  {
    id: 'L1',
    prompt: 'Which file exports `formatDate`, and what does it depend on? Answer with file paths.',
    checker: {
      type: 'answer',
      answerMustMatch: [
        'utils/helpers\\.(ts|js)\\b',
        'no (external |third[- ]party |npm |node )?(imports|dependencies|deps)( at all)?|self[- ]contained|standalone|zero (imports|dependencies)|nothing (to import|outside|imported)|does.?t (import|depend|rely|use) (on |anything |any |external)|only (uses?|imports?)( the )?(built[- ]?in|standard|native|js|javascript|date)|depend(s)? only on (the )?(built[- ]?in|standard|native|js|javascript|date)',
      ],
    },
  },
  {
    id: 'L2',
    prompt:
      'Add `slugify(text: string): string` to the utils module of this project ' +
      '(src/utils/helpers.ts) and export it from the utils barrel (src/utils/index.ts). ' +
      'Keep the existing code style.',
    checker: {
      type: 'symbol',
      symbol: 'slugify',
      barrel: 'src/utils/index.ts',
    },
  },
  {
    id: 'L3',
    prompt:
      'Add `parseDuration(str: string): number | null` to the utils module of this project ' +
      '(src/utils/helpers.ts) and export it from the utils barrel (src/utils/index.ts). ' +
      'It parses durations: "90s" → 90000 ms, "1h 30m" → 5400000 ms, ' +
      '"1h30m" → 5400000 ms, "not a duration" → null. Match the existing code style.',
    checker: {
      type: 'tests',
      checkFile: 'parse-duration.check.test.ts',
    },
  },
];

export const DEFAULT_LIVE_TASKS = 'L1,L2';

export function tasksByIds(ids: string[]): LiveTask[] {
  const found: LiveTask[] = [];
  for (const id of ids) {
    const t = LIVE_TASKS.find((x) => x.id === id);
    if (!t)
      throw new Error(
        `bench:live: unknown task id ${id} (known: ${LIVE_TASKS.map((x) => x.id).join(', ')})`,
      );
    found.push(t);
  }
  return found;
}
