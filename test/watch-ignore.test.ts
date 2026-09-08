import { describe, it, expect } from 'vitest';
import {
  SKIP_DIR_NAMES,
  SKIP_PATH_SUFFIXES,
  isListedDirName,
  makeWatchIgnorePredicate,
  skipDir,
  skipDirName,
  isUnderSkippedPath,
  WATCH_DIR_WARN_THRESHOLD,
} from '../src/shared/ignore.js';

const asFile = { isDirectory: () => false };
const asDir = { isDirectory: () => true };

describe('skipDirName', () => {
  it('skips the dependency directories behind both EMFILE incidents', () => {
    // 2026-07-28 was PHP vendor/; node_modules is the JS equivalent.
    expect(skipDirName('vendor')).toBe(true);
    expect(skipDirName('node_modules')).toBe(true);
  });

  it('skips every dot-directory, including ones nobody has listed yet', () => {
    for (const name of ['.git', '.worktrees', '.factory', '.turbo', '.some-future-tool']) {
      expect(skipDirName(name)).toBe(true);
    }
  });

  it('does not skip ordinary source directories', () => {
    for (const name of ['src', 'app', 'laravel', 'terraform', 'tests', 'vendors', 'storage']) {
      expect(skipDirName(name)).toBe(false);
    }
  });

  it('keeps a bare `storage` indexable — it is a real source directory outside Laravel', () => {
    // The Laravel subtrees that misbehave are scoped by path, not by name, so
    // an Android/Go/Rust `storage/` full of source is not silently dropped.
    expect(skipDirName('storage')).toBe(false);
    expect(SKIP_DIR_NAMES.has('storage')).toBe(false);
  });
});

describe('isUnderSkippedPath', () => {
  it('skips the Laravel subtrees that churn or hold generated code', () => {
    expect(isUnderSkippedPath('/repo/laravel/storage/framework')).toBe(true);
    expect(isUnderSkippedPath('/repo/laravel/storage/logs')).toBe(true);
    // and everything under them, which is where compiled Blade and the log
    // file actually live — matching only the directory left those watched.
    expect(isUnderSkippedPath('/repo/laravel/storage/framework/views')).toBe(true);
    expect(isUnderSkippedPath('/repo/laravel/storage/logs/laravel.log')).toBe(true);
  });

  it('does not skip a storage directory that is not one of those', () => {
    expect(isUnderSkippedPath('/repo/laravel/storage')).toBe(false);
    expect(isUnderSkippedPath('/repo/storage/app')).toBe(false);
  });

  it('matches a suffix only on a segment boundary', () => {
    expect(isUnderSkippedPath('/repo/my-storage/logs')).toBe(false);
    expect(isUnderSkippedPath('/repo/storage/logs')).toBe(true);
  });

  it('normalises Windows separators', () => {
    expect(isUnderSkippedPath('C:\\repo\\laravel\\storage\\logs')).toBe(true);
  });

  it('exposes the suffixes it enforces', () => {
    expect([...SKIP_PATH_SUFFIXES]).toEqual(['storage/framework', 'storage/logs']);
  });
});

describe('makeWatchIgnorePredicate', () => {
  const ignored = makeWatchIgnorePredicate();

  it('rejects the directory types behind both incidents', () => {
    expect(ignored('/dev/LM/.worktrees/clx-777/app/Foo.php', asFile)).toBe(true);
    expect(ignored('/dev/LM/.factory/worktrees/CLX-734/x.php', asFile)).toBe(true);
    expect(ignored('/dev/LM/laravel/vendor/acme/src/A.php', asFile)).toBe(true);
    expect(ignored('/dev/LM/laravel/storage/logs/laravel.log', asFile)).toBe(true);
    expect(ignored('/dev/LM/laravel/storage/framework/views/abc.php', asFile)).toBe(true);
  });

  it('rejects a match at any depth, not only the first segment', () => {
    expect(ignored('/a/b/c/node_modules/d/index.js', asFile)).toBe(true);
    expect(ignored('/a/node_modules', asDir)).toBe(true);
  });

  it('keeps ordinary source files', () => {
    expect(ignored('/dev/repo/src/server/indexer.ts', asFile)).toBe(false);
    expect(ignored('/dev/repo/laravel/app/Models/Lead.php', asFile)).toBe(false);
    expect(ignored('/dev/repo/laravel/storage/app/keep.php', asFile)).toBe(false);
  });

  it('does not un-watch a dotFILE — the regression the dot rule invites', () => {
    // A file whose own name starts with a dot must stay watched. Only a
    // dot-DIRECTORY is skipped.
    expect(ignored('/dev/repo/.gitignore', asFile)).toBe(false);
    expect(ignored('/dev/repo/.env.example', asFile)).toBe(false);
    expect(ignored('/dev/repo/.prettierrc', asFile)).toBe(false);
  });

  it('still skips a dot-DIRECTORY of the same shape', () => {
    expect(ignored('/dev/repo/.husky', asDir)).toBe(true);
  });

  it('when chokidar supplies no stats, judges the basename by the listed names only', () => {
    // Unknowable whether it is a file: applying the dot rule here would
    // un-watch .gitignore, so only implausible-as-a-filename names apply.
    expect(ignored('/dev/repo/.gitignore')).toBe(false);
    expect(ignored('/dev/repo/node_modules')).toBe(true);
    expect(ignored('/dev/repo/src')).toBe(false);
    // Children are still rejected by the ancestor rule, so a dot-dir that
    // slips through costs one directory, not a subtree.
    expect(ignored('/dev/repo/.husky/pre-commit')).toBe(true);
  });

  it('keeps a FILE whose path shape coincides with a skipped subtree', () => {
    // A file literally named `logs` inside a `storage/` directory is source,
    // not the Laravel log directory. Same reasoning as the dotfile case.
    expect(ignored('/repo/laravel/storage/logs', asFile)).toBe(false);
    expect(ignored('/repo/laravel/storage/logs', asDir)).toBe(true);
    // Files genuinely inside it are still ignored, via the ancestor rule.
    expect(ignored('/repo/laravel/storage/logs/laravel.log', asFile)).toBe(true);
  });

  it('handles Windows separators, drive letter included', () => {
    expect(ignored('C:\\dev\\repo\\.worktrees\\clx-1\\a.ts', asFile)).toBe(true);
    expect(ignored('C:\\dev\\repo\\src\\a.ts', asFile)).toBe(false);
    // A skip directory immediately under the drive root: the drive becomes its
    // own segment ('C:'), which matches nothing, so the real segment decides.
    expect(ignored('C:\\node_modules\\x.js', asFile)).toBe(true);
    expect(ignored('C:\\src\\x.js', asFile)).toBe(false);
  });

  it('keeps a submodule watched — its source is indexed, so skipping it would go stale', () => {
    // A structural "skip anything containing .git" rule was tried and rejected:
    // a worktree and a submodule both carry .git as a file, and this tree has
    // three submodules whose source IS indexed. See the note in ignore.ts.
    expect(ignored('/dev/LM/PLAT_MasterDataManagement/functions/x.go', asFile)).toBe(false);
    expect(ignored('/dev/LM/PLAT_MasterDataManagement', asDir)).toBe(false);
  });
});

describe('skipDir', () => {
  it('combines the name and path rules', () => {
    expect(skipDir('/repo/node_modules')).toBe(true);
    expect(skipDir('/repo/laravel/storage/logs')).toBe(true);
    expect(skipDir('/repo/.worktrees')).toBe(true);
    expect(skipDir('/repo/src')).toBe(false);
  });

  it('touches no filesystem, so it is safe on a path that does not exist', () => {
    expect(skipDir('/definitely/not/here/src')).toBe(false);
    expect(skipDir('/definitely/not/here/vendor')).toBe(true);
  });
});

describe('the watcher/indexer invariant', () => {
  it('keeps every name the pre-refactor indexer list had', () => {
    // Regression pin: the old SKIP_DIRS enumerated these. Dropping one would
    // start indexing a dependency or cache directory again.
    for (const name of [
      'node_modules',
      '.git',
      'dist',
      '.next',
      'build',
      'coverage',
      '.turbo',
      '.cache',
      '.output',
      '.nuxt',
      '.svelte-kit',
      '__pycache__',
      '.venv',
      'venv',
      '.vitepress',
      '.temp',
    ]) {
      expect(skipDirName(name)).toBe(true);
    }
  });

  it('adds vendor, which the indexer was missing', () => {
    // 19,052 of 24,777 indexed files were Composer dependencies on 2026-09-08.
    expect(SKIP_DIR_NAMES.has('vendor')).toBe(true);
  });

  it('has one predicate, so the watcher cannot skip what the indexer indexes', () => {
    // Both callers read skipDirName/isUnderSkippedPath. If someone re-adds a
    // watcher-only rule, these dot-directories are where it would show up
    // first: the indexer skips them too, so the sides must agree.
    for (const name of ['.github', '.claude', '.docs', '.bruno']) {
      expect(skipDirName(name)).toBe(true);
      expect(isListedDirName(name)).toBe(false);
    }
  });

  it('warns below the kernel handle limit rather than at it', () => {
    expect(WATCH_DIR_WARN_THRESHOLD).toBeGreaterThan(0);
    expect(WATCH_DIR_WARN_THRESHOLD).toBeLessThan(10_000);
  });
});
