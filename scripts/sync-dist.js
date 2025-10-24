#!/usr/bin/env node
// Copies dist/* files into the packages as index.js for publish.
// Mapping: package -> dist file
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const mapping = {
  'packages/pan-bus/index.js': 'dist/pan-bus.js',
  'packages/pan-client/index.js': 'dist/pan-client.js',
  'packages/pan-inspector/index.js': 'dist/pan-inspector.js'
};

for (const [dst, src] of Object.entries(mapping)) {
  const from = resolve(root, src);
  const to = resolve(root, dst);
  const code = readFileSync(from);
  writeFileSync(to, code);
  console.log('Synced', src, '->', dst);
}

