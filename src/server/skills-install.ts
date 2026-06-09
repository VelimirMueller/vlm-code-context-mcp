import fs from "fs";
import path from "path";

export interface CopyOptions {
  /** Basenames to skip at any depth (e.g. [".source.json"]). */
  exclude?: string[];
}

/**
 * Recursively copy files from srcDir into destDir.
 * - Creates destination directories as needed.
 * - Never overwrites a file that already exists at the destination.
 * - Skips any entry whose basename is listed in opts.exclude.
 * Returns the number of files copied.
 */
export function copyDirNonDestructive(
  srcDir: string,
  destDir: string,
  opts: CopyOptions = {},
): number {
  const exclude = new Set(opts.exclude ?? []);
  let copied = 0;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copied += copyDirNonDestructive(srcPath, destPath, opts);
    } else if (entry.isFile()) {
      if (fs.existsSync(destPath)) continue; // non-destructive
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}
