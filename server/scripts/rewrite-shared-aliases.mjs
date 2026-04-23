#!/usr/bin/env node
/**
 * Rewrites `@shared/*` alias imports in compiled server output to
 * relative paths pointing to `shared/dist/*`.
 *
 * Why: `tsc-alias` cannot rewrite alias targets that resolve outside
 * the project's `outDir` (cross-workspace paths in our monorepo).
 * This script is a small, deterministic replacement for that one alias.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(SERVER_ROOT, 'dist');
const SHARED_DIST_ABS = path.resolve(SERVER_ROOT, '..', 'shared', 'dist');
const ALIAS_PREFIX = '@shared/';
const TARGET_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.d.ts']);

if (!fs.existsSync(DIST_DIR)) {
  console.warn(`[rewrite-shared-aliases] dist not found, skipping: ${DIST_DIR}`);
  process.exit(0);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
      continue;
    }
    const isDts = full.endsWith('.d.ts');
    const ext = isDts ? '.d.ts' : path.extname(full);
    if (TARGET_EXTENSIONS.has(ext)) yield full;
  }
}

const ALIAS_PATTERN = /(['"])@shared\/([^'"\n]+)\1/g;
let touchedFiles = 0;
let totalReplacements = 0;

for (const file of walk(DIST_DIR)) {
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(ALIAS_PREFIX)) continue;

  const fileDir = path.dirname(file);
  const relativeToShared = path
    .relative(fileDir, SHARED_DIST_ABS)
    .split(path.sep)
    .join('/');

  let fileReplacements = 0;
  const updated = original.replace(ALIAS_PATTERN, (_match, quote, subpath) => {
    fileReplacements += 1;
    const prefix = relativeToShared.startsWith('.') ? relativeToShared : `./${relativeToShared}`;
    return `${quote}${prefix}/${subpath}${quote}`;
  });

  if (fileReplacements > 0) {
    fs.writeFileSync(file, updated);
    touchedFiles += 1;
    totalReplacements += fileReplacements;
  }
}

console.log(
  `[rewrite-shared-aliases] rewrote ${totalReplacements} import(s) across ${touchedFiles} file(s)`,
);
