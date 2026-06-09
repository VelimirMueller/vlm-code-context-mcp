#!/usr/bin/env node
// Vendor the skills/ tree from the claude_development_skills plugin repo.
// Pure helpers are exported for tests; main() runs only on direct invocation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_REPO = "https://github.com/VelimirMueller/claude_development_skills";
const DEFAULT_REF = "main";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const VENDOR_DIR = path.join(REPO_ROOT, "skills");

/** Recursively copy srcDir into destDir, overwriting existing files. */
export function copyTree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyTree(src, dest);
    else if (entry.isFile()) fs.copyFileSync(src, dest);
  }
}

/** Count SKILL.md files anywhere under dir. */
export function countSkillFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countSkillFiles(full);
    else if (entry.name === "SKILL.md") count++;
  }
  return count;
}

/** Write skills/.source.json. Returns the manifest object. */
export function writeSourceManifest(vendorDir, info) {
  const manifest = {
    source: info.source,
    ref: info.ref,
    commit: info.commit,
    syncedAt: info.syncedAt,
    skillCount: info.skillCount,
  };
  fs.writeFileSync(
    path.join(vendorDir, ".source.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}

function parseArgs(argv) {
  const out = { repo: DEFAULT_REPO, ref: DEFAULT_REF };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--ref") out.ref = argv[++i];
  }
  return out;
}

function main() {
  const { repo, ref } = parseArgs(process.argv.slice(2));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-skills-"));
  const clone = path.join(tmp, "plugin");
  try {
    console.log(`Cloning ${repo}@${ref} ...`);
    execFileSync("git", ["clone", "--depth", "1", "--branch", ref, repo, clone], { stdio: "inherit" });

    const upstreamSkills = path.join(clone, "skills");
    if (!fs.existsSync(upstreamSkills)) {
      console.error(`ERROR: no skills/ directory in ${repo}@${ref}`);
      process.exit(1);
    }
    const commit = execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();

    // Build into a staging dir, then replace the live tree as the final step.
    const staging = path.join(tmp, "skills");
    copyTree(upstreamSkills, staging);
    fs.rmSync(VENDOR_DIR, { recursive: true, force: true });
    copyTree(staging, VENDOR_DIR);

    const skillCount = countSkillFiles(VENDOR_DIR);
    const manifest = writeSourceManifest(VENDOR_DIR, {
      source: repo,
      ref,
      commit,
      syncedAt: new Date().toISOString(),
      skillCount,
    });
    console.log(`Vendored ${skillCount} skills from ${repo}@${commit.slice(0, 7)}`);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
