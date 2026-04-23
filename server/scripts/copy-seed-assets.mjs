#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'src', 'seed', 'demo-assets');
const targetDir = path.join(projectRoot, 'dist', 'seed', 'demo-assets');

if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-seed-assets] source not found, skipping: ${sourceDir}`);
  process.exit(0);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`[copy-seed-assets] copied ${path.relative(projectRoot, sourceDir)} -> ${path.relative(projectRoot, targetDir)}`);
