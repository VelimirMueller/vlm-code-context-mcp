import fs from "fs";
import path from "path";

export interface CopyOptions {
  /** Basenames to skip at any depth (e.g. [".source.json"]). */
  exclude?: string[];
  /**
   * Top-level directory names whose CHILDREN are lifted into destDir while the
   * directory itself is dropped. Used to strip the domain wrapper (e.g. "frontend")
   * so skills land at .claude/skills/<skill>/ — the one-level layout Claude Code
   * discovers — while keeping each skill dir a sibling of _shared/ so the skills'
   * `../_shared/...` references still resolve. Only applied to direct children of
   * the initial srcDir, not to deeper directories.
   */
  flattenTopLevel?: string[];
}

/**
 * Recursively copy files from srcDir into destDir.
 * - Creates destination directories as needed.
 * - Never overwrites a file that already exists at the destination.
 * - Skips any entry whose basename is listed in opts.exclude.
 * - Lifts the children of any top-level directory named in opts.flattenTopLevel.
 * Returns the number of files copied.
 */
export function copyDirNonDestructive(
  srcDir: string,
  destDir: string,
  opts: CopyOptions = {},
): number {
  const exclude = new Set(opts.exclude ?? []);
  const flatten = new Set(opts.flattenTopLevel ?? []);
  let copied = 0;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);

    // Drop this directory level and lift its children into destDir. flattenTopLevel
    // is intentionally not propagated, so only the top level is flattened.
    if (entry.isDirectory() && flatten.has(entry.name)) {
      copied += copyDirNonDestructive(srcPath, destDir, { exclude: opts.exclude });
      continue;
    }

    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyDirNonDestructive(srcPath, destPath, { exclude: opts.exclude });
    } else if (entry.isFile()) {
      if (fs.existsSync(destPath)) continue; // non-destructive
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}
