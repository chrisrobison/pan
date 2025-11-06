#!/usr/bin/env node

/**
 * Build script for PAN package
 *
 * Creates the dist/ folder with:
 * - dist/index.js - Bundled core (bus + client)
 * - dist/autoload.js - Component autoloader
 * - dist/inspector.js - DevTools inspector
 * - dist/components/*.js - Individual feature components
 * - dist/ui/*.js - UI building blocks
 * - dist/app/*.js - App-level components
 * - dist/core/*.js - Core utilities
 * - dist/data/*.js - Data layer components
 */

import * as esbuild from 'esbuild';
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Clean and create dist directory
if (existsSync(distDir)) {
  console.log('Cleaning dist/ directory...');
  await import('fs/promises').then(fs => fs.rm(distDir, { recursive: true, force: true }));
}
mkdirSync(distDir, { recursive: true });

console.log('Building PAN package...\n');

// ============================================================================
// 1. Bundle core (bus + client) into single entry point
// ============================================================================
console.log('📦 Bundling core (bus + client)...');
await esbuild.build({
  entryPoints: [join(rootDir, 'src/index.js')],
  bundle: true,
  format: 'esm',
  outfile: join(distDir, 'index.js'),
  minify: false,
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
});
console.log('   ✓ dist/index.js\n');

// ============================================================================
// 2. Transform individual components (no bundling)
// ============================================================================
async function transformComponents(sourceDir, destSubDir, label) {
  const sourcePath = join(rootDir, 'src', sourceDir);
  if (!existsSync(sourcePath)) {
    console.log(`   ⚠ Skipping ${sourceDir}/ (not found)`);
    return;
  }

  const files = readdirSync(sourcePath).filter(f => f.endsWith('.mjs'));
  if (files.length === 0) {
    console.log(`   ⚠ No .mjs files in ${sourceDir}/`);
    return;
  }

  const destPath = join(distDir, destSubDir);
  mkdirSync(destPath, { recursive: true });

  console.log(`📦 Transforming ${label} (${files.length} files)...`);

  for (const file of files) {
    const entryPoint = join(sourcePath, file);
    const outfile = join(destPath, basename(file, '.mjs') + '.js');

    await esbuild.build({
      entryPoints: [entryPoint],
      format: 'esm',
      outfile,
      bundle: false,
      minify: false,
      platform: 'browser',
      target: 'es2022',
      sourcemap: true,
    });
  }

  console.log(`   ✓ dist/${destSubDir}/ (${files.length} files)\n`);

  // Copy TypeScript definitions
  const dtsFiles = readdirSync(sourcePath).filter(f => f.endsWith('.d.ts'));
  for (const dtsFile of dtsFiles) {
    const srcFile = join(sourcePath, dtsFile);
    const destFile = join(destPath, dtsFile);
    copyFileSync(srcFile, destFile);
  }
  if (dtsFiles.length > 0) {
    console.log(`   ✓ Copied ${dtsFiles.length} .d.ts files\n`);
  }
}

// Transform all component directories
await transformComponents('core', 'core', 'core utilities');
await transformComponents('components', 'components', 'feature components');
await transformComponents('ui', 'ui', 'UI building blocks');
await transformComponents('app', 'app', 'app components');
await transformComponents('data', 'data', 'data layer');

// ============================================================================
// 3. Special handling for autoload and inspector (top-level exports)
// ============================================================================
console.log('📦 Transforming autoload & inspector...');

// Autoload
const autoloadSource = join(rootDir, 'src/core/pan-autoload.mjs');
if (existsSync(autoloadSource)) {
  await esbuild.build({
    entryPoints: [autoloadSource],
    format: 'esm',
    outfile: join(distDir, 'autoload.js'),
    bundle: false,
    minify: false,
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
  });
  console.log('   ✓ dist/autoload.js');
}

// Inspector
const inspectorSource = join(rootDir, 'src/app/pan-inspector.mjs');
if (existsSync(inspectorSource)) {
  await esbuild.build({
    entryPoints: [inspectorSource],
    format: 'esm',
    outfile: join(distDir, 'inspector.js'),
    bundle: false,
    minify: false,
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
  });
  console.log('   ✓ dist/inspector.js');
}

// ============================================================================
// 4. Copy package metadata files
// ============================================================================
console.log('\n📦 Copying package metadata...');

const packageJsonSource = join(rootDir, 'packages/pan/package.json');
if (existsSync(packageJsonSource)) {
  copyFileSync(packageJsonSource, join(distDir, 'package.json'));
  console.log('   ✓ dist/package.json');
}

// Copy README if it exists
const readmeSource = join(rootDir, 'README.md');
if (existsSync(readmeSource)) {
  copyFileSync(readmeSource, join(distDir, 'README.md'));
  console.log('   ✓ dist/README.md');
}

// Copy LICENSE if it exists
const licenseSource = join(rootDir, 'LICENSE');
if (existsSync(licenseSource)) {
  copyFileSync(licenseSource, join(distDir, 'LICENSE'));
  console.log('   ✓ dist/LICENSE');
}

// Copy TypeScript definitions
const indexDts = join(rootDir, 'src/index.d.ts');
if (existsSync(indexDts)) {
  copyFileSync(indexDts, join(distDir, 'index.d.ts'));
  console.log('   ✓ dist/index.d.ts');
}

const autoloadDts = join(rootDir, 'src/core/pan-autoload.d.ts');
if (existsSync(autoloadDts)) {
  copyFileSync(autoloadDts, join(distDir, 'autoload.d.ts'));
  console.log('   ✓ dist/autoload.d.ts');
}

const inspectorDts = join(rootDir, 'src/app/pan-inspector.d.ts');
if (existsSync(inspectorDts)) {
  copyFileSync(inspectorDts, join(distDir, 'inspector.d.ts'));
  console.log('   ✓ dist/inspector.d.ts');
}

console.log('\n✅ Build complete!\n');
console.log('Output structure:');
console.log('  dist/');
console.log('  ├── index.js          (core: bus + client bundled)');
console.log('  ├── autoload.js       (component autoloader)');
console.log('  ├── inspector.js      (devtools inspector)');
console.log('  ├── core/             (core utilities)');
console.log('  ├── components/       (feature components)');
console.log('  ├── ui/               (UI building blocks)');
console.log('  ├── app/              (app components)');
console.log('  └── data/             (data layer)');
