/**
 * `npm run bench:publish` — commit data/ to the bench-results branch and push.
 *
 * Never operates on the current checkout: it stages only data/ inside a temp
 * git worktree checked out on bench-results, then pushes. The current checkout
 * must not itself be bench-results. A missing bench-results branch is
 * bootstrapped as an orphan containing only data/.
 *
 * Options (see `main` below): --run <id>, --dry-run, --no-push.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildIndex, pickLatest } from './lib/index-builder.mts';

export interface PublishOptions {
  repoDir?: string;
  remote?: string;
  branch?: string;
  runId?: string;
  dryRun?: boolean;
  push?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface PublishResult {
  dryRun: boolean;
  runIds: string[];
  commitMessage: string;
  files: string[];
  pushed: boolean;
}

interface LocalRun {
  runId: string;
  file: string;
  data: unknown;
}

function run(cwd: string, env: NodeJS.ProcessEnv | undefined, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...(env ?? {}) },
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runMaybe(cwd: string, env: NodeJS.ProcessEnv | undefined, args: string[]): string | null {
  try {
    return run(cwd, env, args);
  } catch {
    return null;
  }
}

function toplevel(cwd: string): string {
  return run(cwd, undefined, ['rev-parse', '--show-toplevel']);
}

function readRuns(dir: string): LocalRun[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const rawId = (data as Record<string, unknown>).run_id;
      const runId = typeof rawId === 'string' ? rawId : path.basename(f, '.json');
      return { runId, file: path.join(dir, f), data };
    });
}

function remoteRunStems(
  cwd: string,
  env: NodeJS.ProcessEnv | undefined,
  remote: string,
  branch: string,
): Set<string> {
  const out = runMaybe(cwd, env, ['ls-tree', '-r', '--name-only', `${remote}/${branch}`, '--', 'data/runs']);
  if (!out) return new Set();
  return new Set(
    out
      .split('\n')
      .filter((l) => l.endsWith('.json'))
      .map((l) => path.basename(l, '.json')),
  );
}

export function publish(opts: PublishOptions = {}): PublishResult {
  const cwd = opts.repoDir ? path.resolve(opts.repoDir) : toplevel(process.cwd());
  const remote = opts.remote ?? 'origin';
  const branch = opts.branch ?? 'bench-results';
  const env = opts.env;

  const currentBranch = run(cwd, env, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (currentBranch === branch) {
    throw new Error(
      `bench:publish: refuse to run from the ${branch} checkout — switch to a working branch first`,
    );
  }

  const localRuns = readRuns(path.join(cwd, 'data', 'runs'));

  if (!opts.dryRun) runMaybe(cwd, env, ['fetch', remote, branch]);
  const remoteExists =
    runMaybe(cwd, env, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${branch}`]) !==
    null;
  const remoteStems = remoteExists ? remoteRunStems(cwd, env, remote, branch) : new Set<string>();

  let newRuns = localRuns.filter((r) => !remoteStems.has(r.runId));
  if (opts.runId) newRuns = newRuns.filter((r) => r.runId === opts.runId);

  if (newRuns.length === 0) {
    const hint = opts.runId ? ` --run ${opts.runId}` : '';
    throw new Error(
      `bench:publish: no new runs to publish (local data/runs has ${localRuns.length} run(s), ` +
        `remote has ${remoteStems.size})${hint}`,
    );
  }

  const runIds = newRuns.map((r) => r.runId);
  const commitMessage = `bench: add ${runIds.join(', ')}`;
  const files = newRuns.map((r) => `data/runs/${r.runId}.json`);

  if (opts.dryRun) {
    return { dryRun: true, runIds, commitMessage, files, pushed: false };
  }

  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bench-publish-')));
  const localBranchExists =
    runMaybe(cwd, env, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]) !== null;

  try {
    if (localBranchExists) {
      run(cwd, env, ['worktree', 'add', tmp, branch]);
    } else if (remoteExists) {
      run(cwd, env, ['worktree', 'add', '-b', branch, tmp, `${remote}/${branch}`]);
    } else {
      run(cwd, env, ['worktree', 'add', '--detach', tmp, 'HEAD']);
      run(tmp, env, ['checkout', '--orphan', branch]);
      run(tmp, env, ['rm', '-rf', '--cached', '.']);
    }

    const runsDir = path.join(tmp, 'data', 'runs');
    fs.mkdirSync(runsDir, { recursive: true });
    for (const r of newRuns) {
      fs.copyFileSync(r.file, path.join(runsDir, `${r.runId}.json`));
    }

    const merged = readRuns(runsDir);
    const index = buildIndex(merged.map((m) => m.data));
    const latest = pickLatest(merged.map((m) => m.data));
    fs.writeFileSync(path.join(tmp, 'data', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
    fs.writeFileSync(
      path.join(tmp, 'data', 'latest.json'),
      `${JSON.stringify(latest, null, 2)}\n`,
    );

    const commitEnv: NodeJS.ProcessEnv = { ...env };
    if (process.env.CI === 'true') {
      commitEnv.GIT_AUTHOR_NAME = 'github-actions[bot]';
      commitEnv.GIT_AUTHOR_EMAIL = 'github-actions[bot]@users.noreply.github.com';
      commitEnv.GIT_COMMITTER_NAME = 'github-actions[bot]';
      commitEnv.GIT_COMMITTER_EMAIL = 'github-actions[bot]@users.noreply.github.com';
    }
    run(tmp, commitEnv, ['add', '-A', '--', 'data']);
    run(tmp, commitEnv, ['commit', '-m', commitMessage]);

    let pushed = false;
    if (opts.push !== false) {
      run(tmp, commitEnv, ['push', remote, branch]);
      pushed = true;
    }

    return {
      dryRun: false,
      runIds,
      commitMessage,
      files: [...files, 'data/index.json', 'data/latest.json'],
      pushed,
    };
  } finally {
    runMaybe(cwd, env, ['worktree', 'remove', '--force', tmp]);
  }
}

function isMain(): boolean {
  return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const args = process.argv.slice(2);
  const opts: PublishOptions = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--run') opts.runId = args[++i];
    else if (args[i] === '--no-push') opts.push = false;
    else {
      console.error(`bench:publish: unknown argument ${args[i]}`);
      process.exit(1);
    }
  }
  try {
    const res = publish(opts);
    if (res.dryRun) {
      console.log(`dry-run: would commit "${res.commitMessage}"`);
      for (const f of res.files) console.log(`  ${f}`);
    } else {
      console.log(`published ${res.runIds.join(', ')} (${res.files.length} files)`);
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
