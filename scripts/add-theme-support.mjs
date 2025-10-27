#!/usr/bin/env node

/**
 * Script to add theme support to all HTML files in the PAN project
 *
 * This script:
 * 1. Adds <link rel="stylesheet" href="assets/theme.css"> or ../assets/theme.css depending on location
 * 2. Removes old :root color variable definitions
 * 3. Adds pan-theme-provider and pan-theme-toggle imports at the end
 * 4. Replaces hardcoded color values with CSS variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Files to update
const htmlFiles = [
  'grid.html',
  'pan-grid.html',
  'examples/00-intro.html',
  'examples/10-sse-store.html',
  'examples/13-sse-pan.html',
  'examples/14-forwarder.html',
  'demo-apps/data-browser.html',
  'conformance/index.html',
  'registry/index.html',
  'templates/provider-kit/index.html'
];

function getThemeCssPath(htmlPath) {
  // Determine the correct relative path to theme.css
  const depth = htmlPath.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) + 'assets/theme.css' : 'assets/theme.css';
}

function getComponentsPath(htmlPath) {
  const depth = htmlPath.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) + 'components/' : './components/';
}

function updateHtmlFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return;
  }

  console.log(`📝 Processing ${filePath}...`);

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // 1. Add theme.css link if not present
  const themeCssPath = getThemeCssPath(filePath);
  if (!content.includes('assets/theme.css')) {
    const headCloseMatch = content.match(/<\/head>/);
    if (headCloseMatch) {
      const insertPos = headCloseMatch.index;
      content = content.slice(0, insertPos) +
        `  <link rel="stylesheet" href="${themeCssPath}">\n` +
        content.slice(insertPos);
      modified = true;
      console.log(`  ✓ Added theme.css link`);
    }
  }

  // 2. Remove old :root color definitions (between :root { and matching })
  const rootVarPattern = /:root\s*\{[^}]*--color-[^}]*\}/gs;
  if (rootVarPattern.test(content)) {
    content = content.replace(rootVarPattern, '');
    modified = true;
    console.log(`  ✓ Removed old :root color variables`);
  }

  // 3. Replace hardcoded white backgrounds
  const whiteBackgroundPattern = /background:\s*white;/g;
  if (whiteBackgroundPattern.test(content)) {
    content = content.replace(whiteBackgroundPattern, 'background: var(--color-surface);');
    modified = true;
    console.log(`  ✓ Replaced hardcoded white backgrounds`);
  }

  const whiteColorPattern = /background:\s*#ffffff;/gi;
  if (whiteColorPattern.test(content)) {
    content = content.replace(whiteColorPattern, 'background: var(--color-surface);');
    modified = true;
    console.log(`  ✓ Replaced hardcoded #ffffff backgrounds`);
  }

  // 4. Add theme provider and toggle if not present
  const componentsPath = getComponentsPath(filePath);
  if (!content.includes('pan-theme-provider')) {
    const bodyCloseMatch = content.match(/<\/body>/);
    if (bodyCloseMatch) {
      const insertPos = bodyCloseMatch.index;
      const themeBlock = `
  <!-- Theme System -->
  <pan-theme-provider theme="auto"></pan-theme-provider>

  <script type="module">
    import '${componentsPath}pan-theme-provider.mjs';
    import '${componentsPath}pan-theme-toggle.mjs';
  </script>
`;
      content = content.slice(0, insertPos) + themeBlock + content.slice(insertPos);
      modified = true;
      console.log(`  ✓ Added theme provider and toggle`);
    }
  }

  // 5. Replace old purple/indigo colors with new blue
  const purpleColorPattern = /#6366f1|#4f46e5/gi;
  if (purpleColorPattern.test(content)) {
    content = content.replace(/#6366f1/gi, 'var(--color-primary)');
    content = content.replace(/#4f46e5/gi, 'var(--color-primary-dark)');
    modified = true;
    console.log(`  ✓ Replaced purple colors with theme variables`);
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ℹ️  No changes needed for ${filePath}`);
  }
}

console.log('🎨 Starting theme support update...\n');

htmlFiles.forEach(file => {
  try {
    updateHtmlFile(file);
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
  console.log('');
});

console.log('✨ Theme support update complete!');
console.log('\n📝 Manual steps still needed:');
console.log('  1. Add <pan-theme-toggle variant="icon"></pan-theme-toggle> to navigation bars');
console.log('  2. Replace any remaining hardcoded colors with CSS variables');
console.log('  3. Test all pages in both light and dark mode');
