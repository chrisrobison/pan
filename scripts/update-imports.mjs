#!/usr/bin/env node

/**
 * Script to update import paths after reorganization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Mapping of old paths to new paths
const pathMappings = {
  // Core
  './core/pan-bus.mjs': './core/pan-bus.mjs',
  '../core/pan-bus.mjs': '../core/pan-bus.mjs',
  './core/pan-client.mjs': './core/pan-client.mjs',
  '../core/pan-client.mjs': '../core/pan-client.mjs',
  './core/pan-autoload.mjs': './core/pan-autoload.mjs',
  '../core/pan-autoload.mjs': '../core/pan-autoload.mjs',

  // UI
  './ui/pan-card.mjs': './ui/pan-card.mjs',
  '../ui/pan-card.mjs': '../ui/pan-card.mjs',
  './ui/pan-modal.mjs': './ui/pan-modal.mjs',
  '../ui/pan-modal.mjs': '../ui/pan-modal.mjs',
  './ui/pan-dropdown.mjs': './ui/pan-dropdown.mjs',
  '../ui/pan-dropdown.mjs': '../ui/pan-dropdown.mjs',
  './ui/pan-tabs.mjs': './ui/pan-tabs.mjs',
  '../ui/pan-tabs.mjs': '../ui/pan-tabs.mjs',
  './ui/pan-link.mjs': './ui/pan-link.mjs',
  '../ui/pan-link.mjs': '../ui/pan-link.mjs',
  './ui/pan-search-bar.mjs': './ui/pan-search-bar.mjs',
  '../ui/pan-search-bar.mjs': '../ui/pan-search-bar.mjs',
  './ui/pan-pagination.mjs': './ui/pan-pagination.mjs',
  '../ui/pan-pagination.mjs': '../ui/pan-pagination.mjs',
  './ui/editable-cell.mjs': './ui/editable-cell.mjs',
  '../ui/editable-cell.mjs': '../ui/editable-cell.mjs',
  './ui/file-upload.mjs': './ui/file-upload.mjs',
  '../ui/file-upload.mjs': '../ui/file-upload.mjs',
  './ui/user-avatar.mjs': './ui/user-avatar.mjs',
  '../ui/user-avatar.mjs': '../ui/user-avatar.mjs',

  // Data
  './data/pan-invoice-store.mjs': './data/pan-invoice-store.mjs',
  '../data/pan-invoice-store.mjs': '../data/pan-invoice-store.mjs',

  // App - Invoice
  './app/invoice/pan-invoice-header.mjs': './app/invoice/pan-invoice-header.mjs',
  '../app/invoice/pan-invoice-header.mjs': '../app/invoice/pan-invoice-header.mjs',
  './app/invoice/pan-invoice-items.mjs': './app/invoice/pan-invoice-items.mjs',
  '../app/invoice/pan-invoice-items.mjs': '../app/invoice/pan-invoice-items.mjs',
  './app/invoice/pan-invoice-totals.mjs': './app/invoice/pan-invoice-totals.mjs',
  '../app/invoice/pan-invoice-totals.mjs': '../app/invoice/pan-invoice-totals.mjs',

  // App - Devtools
  './components/pan-inspector.mjs': './components/pan-inspector.mjs',
  '../components/pan-inspector.mjs': '../components/pan-inspector.mjs',
  './app/devtools/pan-demo-viewer.mjs': './app/devtools/pan-demo-viewer.mjs',
  '../app/devtools/pan-demo-viewer.mjs': '../app/devtools/pan-demo-viewer.mjs',
  './app/devtools/pan-demo-nav.mjs': './app/devtools/pan-demo-nav.mjs',
  '../app/devtools/pan-demo-nav.mjs': '../app/devtools/pan-demo-nav.mjs',
};

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace each mapping
  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    const regex = new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (content.match(regex)) {
      content = content.replace(regex, newPath);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }

  return false;
}

function findFiles(dir, extensions) {
  const files = [];

  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip node_modules and hidden files
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

console.log('🔄 Updating import paths...\n');

// Find all HTML and JS files
const files = findFiles(projectRoot, ['.html', '.mjs', '.js']);

let updatedCount = 0;
for (const file of files) {
  if (updateFile(file)) {
    updatedCount++;
  }
}

console.log(`\n✨ Updated ${updatedCount} files`);
