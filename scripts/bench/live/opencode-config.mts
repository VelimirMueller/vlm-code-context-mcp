/**
 * Per-workspace OpenCode project config (PLAN.md task 8).
 *
 * The config shape is pinned from one verified live capture per provider
 * (opencode 1.18.30): a project-level `opencode.json` with an `mcp` block
 * (`{"mcp":{"code-context":{"type":"local","command":[…]}}}`) attaches the
 * server; a `provider` block defines the DeepSeek provider because this
 * opencode build's catalog has none (verified: `-m deepseek/deepseek-v4-pro`
 * fails without it, works with it, authenticating via DEEPSEEK_API_KEY).
 *
 * The `permission` block is the agent sandbox (security review follow-up).
 * Schema verified against opencode 1.18.30 (`$schema` https://opencode.ai/
 * config.json, `$defs.PermissionConfig`): `bash`/`read`/`edit`/`grep`/`glob`/
 * `list`/`external_directory`/`task`/`skill`/`lsp` are rule configs (a scalar
 * `"allow"|"ask"|"deny"` or a pattern→action map); `webfetch`/`websearch`/
 * `todowrite`/`question`/`doom_loop` are plain `"allow"|"ask"|"deny"`. The
 * rules below leave nothing on `"ask"`, so a headless `opencode run` never
 * blocks on a permission prompt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CODE_CONTEXT_SERVER_ALIAS } from './parse-events.mts';

/**
 * Agent sandbox permissions for the live bench. The agent NEVER executes
 * code: `bash` defaults to deny and allowlists only pure read commands
 * (`ls`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`, `find`,
 * `git status|diff|log`). No `npm`, `npx`, `node`, `tsx`, `vitest`, `sh`,
 * `bash`, `python` — nothing that runs workspace code or package scripts.
 * Task correctness is decided by the checker alone (checkers.mts), which
 * runs the hidden vitest file in its own scrubbed environment.
 *
 * Rule ordering is load-bearing (verified against opencode 1.18.30,
 * packages/opencode/src/permission/index.ts): rules are evaluated
 * last-match-wins over the config key order, and patterns are full-string
 * globs where a trailing `" *"` means "with any arguments (or none)". So
 * `'*': 'deny'` comes first, the command allows override it, and the
 * argument-form denies at the end override the allows:
 *   - `find -exec/-ok…` and `rg --pre…` execute commands via arguments
 *   - `>` / `>>` redirections would turn read commands into writes
 * Compound commands (`&&`, `;`, `|`, `$(…)`) are split per sub-command by
 * opencode's tree-sitter pass and EVERY part must pass the allowlist, so
 * `ls | sh` or `grep x; npm test` are refused on the second part.
 *
 * `webfetch`/`websearch` are denied (no network); `external_directory` denies
 * every path outside the workspace; `task` (sub-agent spawn), `question`
 * (user prompt), `skill` and `lsp` (spawns language servers) are denied.
 */
export const SANDBOX_PERMISSIONS: Record<string, unknown> = {
  read: 'allow',
  edit: 'allow',
  grep: 'allow',
  glob: 'allow',
  list: 'allow',
  bash: {
    '*': 'deny',
    'ls *': 'allow',
    'cat *': 'allow',
    'head *': 'allow',
    'tail *': 'allow',
    'wc *': 'allow',
    'grep *': 'allow',
    'rg *': 'allow',
    'find *': 'allow',
    'git status *': 'allow',
    'git diff *': 'allow',
    'git log *': 'allow',
    'find *-exec*': 'deny',
    'find *-ok*': 'deny',
    'rg *--pre*': 'deny',
    '*>*': 'deny',
  },
  external_directory: { '*': 'deny' },
  webfetch: 'deny',
  websearch: 'deny',
  task: 'deny',
  question: 'deny',
  skill: 'deny',
  lsp: 'deny',
  todowrite: 'allow',
};

/** Verified custom-provider block for DeepSeek ({env:…} is opencode interpolation). */
export const DEEPSEEK_PROVIDER_CONFIG: Record<string, unknown> = {
  npm: '@ai-sdk/openai-compatible',
  name: 'DeepSeek',
  options: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '{env:DEEPSEEK_API_KEY}',
  },
  models: {
    'deepseek-v4-pro': { name: 'DeepSeek V4 Pro' },
  },
};

export interface WriteOpencodeConfigOpts {
  /** Register code-context as the only MCP server, running `command`. */
  mcp?: { command: string[] };
  /** Include the pinned DeepSeek provider block (needed for -m deepseek/…). */
  includeDeepseekProvider?: boolean;
}

/**
 * Write `<workspaceDir>/opencode.json` and return its path. The bench runner
 * isolates HOME per session, so this project config is the ONLY config the
 * opencode process sees — the vanilla arm stays free of MCP servers.
 */
export function writeOpencodeConfig(
  workspaceDir: string,
  opts: WriteOpencodeConfigOpts = {},
): string {
  const config: Record<string, unknown> = {
    permission: SANDBOX_PERMISSIONS,
  };
  if (opts.includeDeepseekProvider) {
    config.provider = { deepseek: DEEPSEEK_PROVIDER_CONFIG };
  }
  if (opts.mcp) {
    config.mcp = {
      [CODE_CONTEXT_SERVER_ALIAS]: {
        type: 'local',
        command: opts.mcp.command,
      },
    };
  }
  const configPath = path.join(workspaceDir, 'opencode.json');
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}
