/**
 * Harness-owned vitest config for the live-bench checker (security audit
 * 2026-10-10, residual: the agent can drop a vitest.config file or package.json
 * into the workspace, and vitest would load it — globalSetup/setupFiles run
 * agent-authored code).
 *
 * checkers.mts spawns vitest as
 *   vitest run --config <this file> --root <workspace> test/<checkFile>
 * (absolute config path — vitest resolves a relative --config against --root),
 * so this file — which lives OUTSIDE every agent workspace — is the only
 * config vitest loads; an agent-authored vitest.config or vitest.workspace
 * file in the workspace is ignored, and `--root` pins the project to the
 * workspace for test discovery only.
 *
 * Keep it minimal and closed: no setupFiles, no globalSetup, no plugins, no
 * reporters from the workspace, nothing agent-writable is loaded as config.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
