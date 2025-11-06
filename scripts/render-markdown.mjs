#!/usr/bin/env node

/**
 * Markdown to HTML Renderer for PAN Documentation
 *
 * Converts all markdown files in the project to styled HTML pages
 * with navigation, syntax highlighting, and a consistent theme.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const siteDir = join(rootDir, 'site');
const docsDir = join(siteDir, 'docs');

// Ensure docs directory exists
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true });
}

/**
 * Simple markdown to HTML converter
 * Supports: headers, lists, code blocks, links, bold, italic, code
 */
function markdownToHtml(markdown) {
  let html = markdown;

  // Escape HTML in code blocks first
  const codeBlocks = [];
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang: lang || 'plaintext', code: escapeHtml(code.trim()) });
    return `__CODE_BLOCK_${index}__`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs (lines that aren't already HTML)
  html = html.split('\n\n').map(para => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<')) return para;
    if (para.startsWith('__CODE_BLOCK_')) return para;
    return `<p>${para}</p>`;
  }).join('\n');

  // Restore code blocks with syntax highlighting
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
    const block = codeBlocks[index];
    return `<pre><code class="language-${block.lang}">${block.code}</code></pre>`;
  });

  return html;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate HTML template for a markdown document
 */
function createHtmlPage(title, content, relativePath) {
  const breadcrumb = generateBreadcrumb(relativePath);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · PAN Documentation</title>
  <meta name="description" content="PAN (Page Area Network) Documentation - ${title}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/theme.css">
  <link rel="stylesheet" href="../assets/docs.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>
<body>
  <header class="docs-header">
    <div class="docs-header-content">
      <a href="../index.html" class="logo">
        <span>PAN</span>
      </a>
      <nav class="docs-nav">
        <a href="../index.html">Home</a>
        <a href="index.html" class="active">Docs</a>
        <a href="../examples.html">Examples</a>
        <a href="../apps.html">Apps</a>
        <a href="https://github.com/chrisrobison/pan" target="_blank">GitHub</a>
      </nav>
    </div>
  </header>

  <div class="docs-layout">
    <aside class="docs-sidebar">
      <div class="docs-sidebar-content">
        <h3>Documentation</h3>
        <nav class="docs-menu" id="docs-menu">
          <!-- Will be populated by JavaScript -->
        </nav>
      </div>
    </aside>

    <main class="docs-main">
      <div class="docs-breadcrumb">
        ${breadcrumb}
      </div>
      <article class="docs-content">
        ${content}
      </article>
      <footer class="docs-footer">
        <a href="https://github.com/chrisrobison/pan/edit/main/${relativePath}" target="_blank">
          Edit this page on GitHub
        </a>
      </footer>
    </main>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="../assets/docs.js"></script>
</body>
</html>`;
}

function generateBreadcrumb(relativePath) {
  const parts = relativePath.split('/');
  let breadcrumb = '<a href="../index.html">Home</a>';
  let path = '';

  for (let i = 0; i < parts.length - 1; i++) {
    path += (path ? '/' : '') + parts[i];
    breadcrumb += ` / <a href="#">${parts[i]}</a>`;
  }

  const filename = parts[parts.length - 1].replace('.md', '');
  breadcrumb += ` / <span>${filename}</span>`;

  return breadcrumb;
}

/**
 * Find all markdown files in the project
 */
function findMarkdownFiles(dir, baseDir = dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, dist, etc.
      if (!['node_modules', '.git', 'dist', 'test-results', 'site'].includes(entry)) {
        findMarkdownFiles(fullPath, baseDir, files);
      }
    } else if (entry.endsWith('.md') && entry !== 'package.json') {
      const relativePath = relative(baseDir, fullPath);
      files.push({ path: fullPath, relativePath });
    }
  }

  return files;
}

/**
 * Convert a markdown file to HTML
 */
function convertMarkdownFile(mdPath, relativePath) {
  console.log(`Converting: ${relativePath}`);

  const markdown = readFileSync(mdPath, 'utf-8');
  const title = extractTitle(markdown) || basename(mdPath, '.md');
  const html = markdownToHtml(markdown);

  // Create output path in site/docs
  const outputPath = join(docsDir, relativePath.replace('.md', '.html'));
  const outputDir = dirname(outputPath);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate and write HTML
  const fullHtml = createHtmlPage(title, html, relativePath);
  writeFileSync(outputPath, fullHtml, 'utf-8');

  return {
    title,
    path: relativePath.replace('.md', '.html'),
    category: dirname(relativePath) === '.' ? 'Root' : dirname(relativePath)
  };
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1] : null;
}

/**
 * Generate docs index page
 */
function generateDocsIndex(docs) {
  // Group docs by category
  const grouped = {};
  for (const doc of docs) {
    if (!grouped[doc.category]) {
      grouped[doc.category] = [];
    }
    grouped[doc.category].push(doc);
  }

  // Sort categories
  const categories = Object.keys(grouped).sort();

  // Generate HTML
  let html = '<div class="docs-index">\n';

  for (const category of categories) {
    const categoryDocs = grouped[category].sort((a, b) => a.title.localeCompare(b.title));

    html += `  <section class="docs-category">\n`;
    html += `    <h2>${category}</h2>\n`;
    html += `    <div class="docs-grid">\n`;

    for (const doc of categoryDocs) {
      html += `      <a href="${doc.path}" class="docs-card">\n`;
      html += `        <h3>${doc.title}</h3>\n`;
      html += `        <p class="docs-path">${doc.path}</p>\n`;
      html += `      </a>\n`;
    }

    html += `    </div>\n`;
    html += `  </section>\n`;
  }

  html += '</div>\n';

  // Create full index page
  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documentation · PAN</title>
  <link rel="stylesheet" href="../assets/theme.css">
  <link rel="stylesheet" href="../assets/docs.css">
</head>
<body>
  <header class="docs-header">
    <div class="docs-header-content">
      <a href="../index.html" class="logo">PAN</a>
      <nav class="docs-nav">
        <a href="../index.html">Home</a>
        <a href="index.html" class="active">Docs</a>
        <a href="../examples.html">Examples</a>
        <a href="../apps.html">Apps</a>
        <a href="https://github.com/chrisrobison/pan" target="_blank">GitHub</a>
      </nav>
    </div>
  </header>

  <div class="docs-layout">
    <main class="docs-main docs-main-wide">
      <h1>Documentation</h1>
      <p class="docs-intro">Browse all documentation for PAN (Page Area Network)</p>
      ${html}
    </main>
  </div>
</body>
</html>`;

  writeFileSync(join(docsDir, 'index.html'), indexHtml, 'utf-8');

  // Also generate a JSON index for the sidebar
  const jsonIndex = JSON.stringify(grouped, null, 2);
  writeFileSync(join(docsDir, 'index.json'), jsonIndex, 'utf-8');
}

/**
 * Main execution
 */
console.log('🔍 Finding markdown files...\n');
const mdFiles = findMarkdownFiles(rootDir);
console.log(`Found ${mdFiles.length} markdown files\n`);

console.log('📝 Converting to HTML...\n');
const docs = [];
for (const { path, relativePath } of mdFiles) {
  const doc = convertMarkdownFile(path, relativePath);
  docs.push(doc);
}

console.log('\n📚 Generating docs index...\n');
generateDocsIndex(docs);

console.log(`✅ Done! Generated ${docs.length} HTML pages in site/docs/\n`);
console.log('   View at: site/docs/index.html');
