#!/usr/bin/env node

/**
 * Update import paths after moving components into pan/ folder
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Recursively find files
function findFiles(dir, extensions = ['.html', '.mjs', '.js']) {
  const results = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        results.push(...findFiles(filePath, extensions));
      } else if (extensions.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
  return results;
}

// Path mappings for the new structure
const pathMappings = {
  // From apps/ or examples/ (already have ../)
  "'../core/": "'../pan/core/",
  '"../core/': '"../pan/core/',
  '`../core/': '`../pan/core/',

  "'../ui/": "'../pan/ui/",
  '"../ui/': '"../pan/ui/',
  '`../ui/': '`../pan/ui/',

  "'../components/": "'../pan/components/",
  '"../components/': '"../pan/components/',
  '`../components/': '`../pan/components/',

  "'../data/": "'../pan/data/",
  '"../data/': '"../pan/data/',
  '`../data/': '`../pan/data/',

  "'../app/": "'../pan/app/",
  '"../app/': '"../pan/app/',
  '`../app/': '`../pan/app/',
};

// Site-specific mappings (files moved from root to site/)
const siteMappings = {
  "'./core/": "'../pan/core/",
  '"./core/': '"../pan/core/',
  '`./core/': '`../pan/core/',

  "'./ui/": "'../pan/ui/",
  '"./ui/': '"../pan/ui/',
  '`./ui/': '`../pan/ui/',

  "'./components/": "'../pan/components/",
  '"./components/': '"../pan/components/',
  '`./components/': '`../pan/components/',

  "'./data/": "'../pan/data/",
  '"./data/': '"../pan/data/',
  '`./data/': '`../pan/data/',

  "'./app/": "'../pan/app/",
  '"./app/': '"../pan/app/',
  '`./app/': '`../pan/app/',

  "'./assets/": "'../assets/",
  '"./assets/': '"../assets/',
  '`./assets/': '`../assets/',
};

// Within pan/ folder, components may reference each other
const panInternalMappings = {
  "'../components/": "'./",
  '"../components/': '"./',
  '`../components/': '`./',
};

let totalUpdated = 0;

// Directories to process
const directories = [
  join(projectRoot, 'apps'),
  join(projectRoot, 'examples'),
  join(projectRoot, 'site'),
  join(projectRoot, 'pan'),
];

directories.forEach(dir => {
  const files = findFiles(dir);

  files.forEach(filePath => {
    let content = readFileSync(filePath, 'utf-8');
    let updated = false;
    const originalContent = content;

    // Determine which mapping set to use
    const relativePath = filePath.substring(projectRoot.length + 1);
    const isSiteFile = relativePath.startsWith('site/');
    const isPanFile = relativePath.startsWith('pan/');

    let mappings = pathMappings;
    if (isSiteFile) {
      mappings = siteMappings;
    }

    // Apply mappings
    for (const [oldPath, newPath] of Object.entries(mappings)) {
      const newContent = content.split(oldPath).join(newPath);
      if (newContent !== content) {
        content = newContent;
        updated = true;
      }
    }

    if (updated) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated: ${relativePath}`);
      totalUpdated++;
    }
  });
});

console.log(`\n✨ Updated ${totalUpdated} files with new import paths`);
