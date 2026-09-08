/**
 * One place that decides which directories the tooling never descends into.
 *
 * Why this file exists: the same omission has taken the dashboard down twice.
 * Three separate policies had drifted apart — the watcher's regex list in
 * `dashboard/dashboard.ts`, `SKIP_DIRS` in `server/indexer.ts`, and an inline
 * dot-directory check in `scrum/tools.ts`. On macOS that is not a tidiness
 * problem: chokidar v4 dropped the native fsevents backend, so every watched
 * directory costs a kernel watch handle, and crossing the limit kills the
 * process with EMFILE seconds after it starts.
 *
 * The two incidents, both on a tree of ~7 repos:
 *   2026-07-28  PHP `vendor/` was not skipped                  → 4,508 dirs
 *   2026-09-08  `.worktrees/` and `.factory/` were not skipped  → 17,657 dirs
 *
 * THE INVARIANT: the watcher must never skip a directory the indexer indexes.
 * Break it and the index silently serves stale content for files it claims to
 * cover — no error, no warning, just answers from the last time someone
 * re-indexed by hand. One shared set is what makes that hold by construction.
 *
 * Note for anyone extending this: the indexer skips EVERY dot-entry, at
 * `server/indexer.ts` in `walkDir` (`entry.name.startsWith(".")`), and
 * `scrum/tools.ts` does the same. Verified against the live index on
 * 2026-09-08: 0 of 24,777 indexed files sat under a dot-directory. So the
 * watcher skipping dot-directories matches the indexer rather than diverging
 * from it — reading `SKIP_DIR_NAMES` alone suggests otherwise and is the wrong
 * conclusion.
 *
 * The one place the two are NOT identical, deliberately: the indexer's check
 * excludes dot-FILES too, so `.env.example` is never indexed, while the watcher
 * keeps watching it (see `makeWatchIgnorePredicate`). That asymmetry is the
 * safe direction — watcher ⊇ indexer means at worst a pointless re-index, never
 * a stale one. Do not "tidy" it by teaching the watcher to skip dotfiles.
 *
 * REJECTED, and worth not re-attempting blind: detecting nested checkouts
 * structurally (skip any directory containing a `.git` entry) as a generic
 * guard against the next tool that invents its own directory. It over-skips.
 * A `git worktree` and a SUBMODULE both carry `.git` as a file, and this tree
 * has three submodules under COX_Lead-Management whose source IS indexed — so
 * the rule dropped the watched count to 780 and would have left that source
 * indexed but unwatched, i.e. silently stale. Telling the two apart means
 * parsing the gitdir pointer (`/worktrees/` vs `/modules/`), which is more
 * machinery than the dot rule already buys: the pipeline puts every worktree
 * under `.worktrees/`, which the dot rule covers.
 */

import path from 'node:path';

/**
 * Directory names that hold dependencies, caches or generated output rather
 * than source. Shared verbatim by the watcher and the indexer.
 *
 * Deliberately NOT here: a bare `storage`. It is a generic name — Android, Go
 * and Rust layouts use it for real source — and the Laravel directory that
 * actually misbehaves contributes only 28 directories. What misbehaves is its
 * churn, so the two subtrees that churn are scoped by path below.
 */
export const SKIP_DIR_NAMES: ReadonlySet<string> = new Set([
  // JS/TS
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.output',
  '.nuxt',
  '.svelte-kit',
  '.vitepress',
  '.temp',
  // PHP / Composer
  'vendor',
  // Python
  '__pycache__',
  'venv',
  '.venv',
  // Git internals
  '.git',
  // Listed for documentation only — both start with a dot, so skipDirName
  // already covers them. They are the two that caused the 2026-09-08 crash:
  // `.worktrees` holds one full duplicate checkout per pipeline ticket branch,
  // and `.factory` is the retired Ticket Factory's state, which holds more.
  '.worktrees',
  '.factory',
]);

/**
 * Path suffixes skipped wherever they appear. Only for directories whose name
 * alone is too generic to skip but whose full path is unambiguous.
 *
 * `storage/framework` holds compiled Blade views — generated PHP that the
 * indexer would otherwise index as source — and `storage/logs` rewrites on
 * every request, which re-triggers the debounced re-index forever.
 */
export const SKIP_PATH_SUFFIXES: readonly string[] = ['storage/framework', 'storage/logs'];

/** Normalise Windows separators so one set of rules covers both platforms. */
function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * True when a directory of this name is skipped, by name alone.
 *
 * Dot-directories are skipped wholesale, matching what the indexer's walk has
 * always done. That is the part which does not need maintaining as new tools
 * invent new directories — `.worktrees` and `.factory` were both already
 * covered by this rule on the indexer side, which is why only the watcher
 * crashed.
 */
export function skipDirName(name: string): boolean {
  return name.startsWith('.') || SKIP_DIR_NAMES.has(name);
}

/**
 * True when this name is one of the explicitly listed directories, WITHOUT the
 * dot rule.
 *
 * Needed for exactly one caller: the watcher, when chokidar hands it a path it
 * has not stat'ed. There a dot-name might be a real file — `.gitignore`, `.env`
 * — and applying the dot rule would silently stop watching it. Every name in
 * the set is implausible as a filename, so it is the safe half to apply blind.
 */
export function isListedDirName(name: string): boolean {
  return SKIP_DIR_NAMES.has(name);
}

/**
 * True when this path IS, or lies anywhere UNDER, one of SKIP_PATH_SUFFIXES.
 *
 * Deliberately file-or-directory, which is why it is not called `skipDir…`: the
 * indexer asks about a directory it is about to enter, but the watcher is handed
 * leaf paths like `storage/logs/laravel.log`, and matching only the directory
 * itself would leave every file inside it watched — which is the churn the rule
 * exists to stop.
 *
 * Boundaries are checked on segments, so `my-storage/logs` does not match
 * `storage/logs`.
 */
export function isUnderSkippedPath(dirPath: string): boolean {
  const posix = toPosix(dirPath);
  return SKIP_PATH_SUFFIXES.some(
    (suffix) =>
      posix === suffix ||
      posix.endsWith(`/${suffix}`) ||
      posix.startsWith(`${suffix}/`) ||
      posix.includes(`/${suffix}/`),
  );
}

/**
 * The single decision both callers use for a directory they are about to
 * descend into. Pure: name and path only, no filesystem access.
 */
export function skipDir(dirPath: string): boolean {
  const name = path.basename(toPosix(dirPath));
  return skipDirName(name) || isUnderSkippedPath(dirPath);
}

/**
 * chokidar `ignored` predicate.
 *
 * chokidar applies this to every path it considers, so each ancestor segment is
 * tested too: `a/node_modules/b` must be rejected even though the last segment
 * is innocent.
 *
 * A path's own basename is only judged as a directory. When chokidar supplies
 * no stats it cannot be told apart from a file, and judging it anyway would
 * un-watch real dotfiles (`.gitignore`, `.env`) — so the last segment is tested
 * against the name set only, which contains no plausible filename. Anything
 * that slips through costs one watched directory, because its children are then
 * judged by the ancestor rule.
 */
export function makeWatchIgnorePredicate(): (
  targetPath: string,
  stats?: { isDirectory(): boolean },
) => boolean {
  return (targetPath, stats) => {
    const posix = toPosix(targetPath);
    const segments = posix.split('/').filter(Boolean);

    // Ancestors are directories by definition, so both rules apply to them
    // unconditionally.
    const ancestors = segments.slice(0, -1);
    if (ancestors.some((segment) => skipDirName(segment))) return true;
    if (ancestors.length > 0 && isUnderSkippedPath(ancestors.join('/'))) {
      return true;
    }

    const isKnownDirectory = stats?.isDirectory() ?? false;
    const last = segments[segments.length - 1];
    if (last === undefined) return false;

    if (isKnownDirectory) {
      // The path rule is only applied to the basename once we know it is a
      // directory, for the same reason as the dot rule below: a FILE named
      // `logs` inside a `storage/` directory is real source, and matching it on
      // path shape alone would silently stop watching it.
      return skipDirName(last) || isUnderSkippedPath(posix);
    }
    // Unstat'ed: the listed names only, never the generic dot rule — `last`
    // could be `.gitignore`. A dot-DIRECTORY that slips through here costs one
    // watched directory, because the ancestor rule above rejects its children.
    return isListedDirName(last);
  };
}

/**
 * Sanity ceiling for the watcher, in directories. Not enforced here — the
 * caller logs when it is crossed, because the failure it precedes (EMFILE)
 * gives no useful stack and reads like a clean exit.
 */
export const WATCH_DIR_WARN_THRESHOLD = 5_000;
