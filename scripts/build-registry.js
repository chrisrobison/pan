#!/usr/bin/env node
// Merge registry entries with package metadata under packages/*/package.json
// Reads registry/index.json and updates/creates entries based on pkg["pan"] metadata.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const pkgDirs = readdirSync(resolve(root, 'packages'), { withFileTypes: true })
  .filter(d=>d.isDirectory())
  .map(d=>resolve(root, 'packages', d.name));

const regPath = resolve(root, 'registry', 'index.json');
const registry = JSON.parse(readFileSync(regPath, 'utf8'));
const byName = new Map(registry.map(e=>[e.name, e]));

for (const dir of pkgDirs) {
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  const meta = pkg.pan; if (!meta) continue;
  const name = pkg.name.replace(/^@[^/]+\//,'') || meta.title || pkg.name;
  const entry = Object.assign({}, byName.get(name)||{}, {
    name,
    title: meta.title || name,
    type: meta.type || 'component',
    version: pkg.version,
    dist: meta.dist || '',
    package: pkg.name,
    license: pkg.license || 'MIT',
    description: pkg.description || '',
    topics: meta.topics || { publishes:[], subscribes:[] },
    retained: meta.retained ?? false,
    demo: meta.demo || '',
    tags: meta.tags || []
  });
  byName.set(name, entry);
}

const out = Array.from(byName.values()).sort((a,b)=> String(a.name).localeCompare(String(b.name)) );
writeFileSync(regPath, JSON.stringify(out, null, 2));
console.log('Registry updated:', regPath, `(${out.length} entries)`);

