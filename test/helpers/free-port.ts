import { execFileSync } from 'node:child_process';

/**
 * A port the OS reports free right now (listen on 0, read it, close).
 *
 * Synchronous on purpose: the spawned-server tests need PORT as a module
 * constant. Replaces `40000 + random(20000)`: parallel test files drew from
 * one range, the dashboard moved to port + 1 on a collision, and the test
 * polled the other file's server until it timed out. The OS hands out
 * distinct ports, so this makes a collision much less likely; it does not
 * remove the short gap before the dashboard binds. waitForServer's temp-DB
 * check stays the real guard against answering the wrong server.
 */
export function freePort(): number {
  const out = execFileSync(
    process.execPath,
    [
      '-e',
      "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});",
    ],
    { encoding: 'utf8' },
  );
  const port = Number(out);
  if (!Number.isInteger(port) || port <= 0)
    throw new Error(`freePort: bad output ${JSON.stringify(out)}`);
  return port;
}
