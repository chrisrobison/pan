#!/usr/bin/env node

/**
 * Documentation Generator for PAN
 *
 * Extracts JSDoc comments from source files and generates HTML documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Output directory
const DOCS_DIR = path.join(ROOT_DIR, 'docs', 'api');

// Source directories to scan
const SOURCE_DIRS = [
  path.join(ROOT_DIR, 'src', 'components'),
];

/**
 * Parse JSDoc comment block
 */
function parseJSDoc(comment) {
  const doc = {
    description: '',
    params: [],
    returns: null,
    examples: [],
    properties: [],
    attributes: [],
    fires: [],
    class: false,
    extends: null,
  };

  const lines = comment.split('\n').map(l => l.trim().replace(/^\*\s?/, ''));

  let currentSection = 'description';
  let currentExample = [];

  for (const line of lines) {
    if (line.startsWith('@')) {
      // Save previous example if any
      if (currentExample.length > 0) {
        doc.examples.push(currentExample.join('\n'));
        currentExample = [];
      }

      const [tag, ...rest] = line.split(/\s+/);
      const content = rest.join(' ');

      switch (tag) {
        case '@param':
          const paramMatch = content.match(/\{([^}]+)\}\s+(\S+)\s*-?\s*(.*)/);
          if (paramMatch) {
            doc.params.push({
              type: paramMatch[1],
              name: paramMatch[2],
              description: paramMatch[3],
            });
          }
          break;

        case '@returns':
        case '@return':
          const returnMatch = content.match(/\{([^}]+)\}\s*(.*)/);
          if (returnMatch) {
            doc.returns = {
              type: returnMatch[1],
              description: returnMatch[2],
            };
          }
          break;

        case '@example':
          currentSection = 'example';
          break;

        case '@property':
        case '@prop':
          const propMatch = content.match(/\{([^}]+)\}\s+(\S+)\s*-?\s*(.*)/);
          if (propMatch) {
            doc.properties.push({
              type: propMatch[1],
              name: propMatch[2],
              description: propMatch[3],
            });
          }
          break;

        case '@attr':
        case '@attribute':
          const attrMatch = content.match(/\{([^}]+)\}\s+(\S+)\s*-?\s*(.*)/);
          if (attrMatch) {
            doc.attributes.push({
              type: attrMatch[1],
              name: attrMatch[2],
              description: attrMatch[3],
            });
          }
          break;

        case '@fires':
          doc.fires.push(content);
          break;

        case '@class':
          doc.class = true;
          break;

        case '@extends':
          doc.extends = content;
          break;

        default:
          currentSection = 'description';
      }
    } else if (currentSection === 'example' && line) {
      currentExample.push(line);
    } else if (currentSection === 'description' && line) {
      doc.description += (doc.description ? '\n' : '') + line;
    }
  }

  // Save last example
  if (currentExample.length > 0) {
    doc.examples.push(currentExample.join('\n'));
  }

  return doc;
}

/**
 * Extract documentation from a file
 */
function extractDocs(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const docs = {
    fileName,
    filePath: path.relative(ROOT_DIR, filePath),
    classes: [],
    functions: [],
    fileDoc: null,
  };

  // Match JSDoc comments followed by class or function
  const commentPattern = /\/\*\*\s*\n([\s\S]*?)\*\/\s*\n\s*(export\s+)?(class|function|const|async function)\s+(\w+)/g;

  let match;
  while ((match = commentPattern.exec(content)) !== null) {
    const [, comment, , type, name] = match;
    const parsed = parseJSDoc(comment);

    const item = {
      name,
      type,
      ...parsed,
    };

    if (type === 'class') {
      docs.classes.push(item);
    } else {
      docs.functions.push(item);
    }
  }

  // Extract file-level JSDoc (at the beginning)
  const fileDocPattern = /^\/\*\*\s*\n([\s\S]*?)\*\//;
  const fileDocMatch = content.match(fileDocPattern);
  if (fileDocMatch) {
    docs.fileDoc = parseJSDoc(fileDocMatch[1]);
  }

  return docs;
}

/**
 * Generate HTML for a single component
 */
function generateComponentHTML(docs) {
  const className = docs.classes[0]?.name || path.parse(docs.fileName).name;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${className} - PAN Documentation</title>
  <link rel="stylesheet" href="../styles/docs.css">
</head>
<body>
  <nav class="sidebar">
    <div class="logo">
      <a href="../index.html">PAN Docs</a>
    </div>
    <div class="nav-section">
      <a href="../index.html">← Back to Index</a>
    </div>
  </nav>

  <main class="content">
    <header class="page-header">
      <h1>${className}</h1>
      <div class="file-path">${docs.filePath}</div>
    </header>
`;

  // File description
  if (docs.fileDoc?.description) {
    html += `
    <section class="section">
      <div class="description">
        ${docs.fileDoc.description.replace(/\n/g, '<br>')}
      </div>
    </section>
`;
  }

  // Classes
  for (const cls of docs.classes) {
    html += `
    <section class="section">
      <h2 id="${cls.name}">Class: ${cls.name}</h2>
      ${cls.extends ? `<div class="extends">Extends: <code>${cls.extends}</code></div>` : ''}
      <div class="description">${cls.description.replace(/\n/g, '<br>')}</div>
`;

    // Attributes
    if (cls.attributes.length > 0) {
      html += `
      <h3>Attributes</h3>
      <table class="params-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
`;
      for (const attr of cls.attributes) {
        html += `
          <tr>
            <td><code>${attr.name}</code></td>
            <td><code>${attr.type}</code></td>
            <td>${attr.description}</td>
          </tr>
`;
      }
      html += `
        </tbody>
      </table>
`;
    }

    // Events
    if (cls.fires.length > 0) {
      html += `
      <h3>Events</h3>
      <ul class="events-list">
`;
      for (const event of cls.fires) {
        html += `        <li><code>${event}</code></li>\n`;
      }
      html += `
      </ul>
`;
    }

    // Examples
    if (cls.examples.length > 0) {
      html += `
      <h3>Examples</h3>
`;
      for (const example of cls.examples) {
        html += `
      <pre><code>${escapeHtml(example)}</code></pre>
`;
      }
    }

    html += `
    </section>
`;
  }

  // Functions/Methods
  if (docs.functions.length > 0) {
    html += `
    <section class="section">
      <h2>Methods</h2>
`;
    for (const fn of docs.functions) {
      html += `
      <div class="method" id="${fn.name}">
        <h3><code>${fn.name}(${fn.params.map(p => p.name).join(', ')})</code></h3>
        <div class="description">${fn.description.replace(/\n/g, '<br>')}</div>
`;

      if (fn.params.length > 0) {
        html += `
        <h4>Parameters</h4>
        <table class="params-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
`;
        for (const param of fn.params) {
          html += `
            <tr>
              <td><code>${param.name}</code></td>
              <td><code>${param.type}</code></td>
              <td>${param.description}</td>
            </tr>
`;
        }
        html += `
          </tbody>
        </table>
`;
      }

      if (fn.returns) {
        html += `
        <h4>Returns</h4>
        <p><code>${fn.returns.type}</code> - ${fn.returns.description}</p>
`;
      }

      if (fn.examples.length > 0) {
        html += `
        <h4>Examples</h4>
`;
        for (const example of fn.examples) {
          html += `
        <pre><code>${escapeHtml(example)}</code></pre>
`;
        }
      }

      html += `
      </div>
`;
    }
    html += `
    </section>
`;
  }

  html += `
  </main>
</body>
</html>
`;

  return html;
}

/**
 * Generate index page
 */
function generateIndexHTML(allDocs) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PAN API Documentation</title>
  <link rel="stylesheet" href="styles/docs.css">
</head>
<body>
  <nav class="sidebar">
    <div class="logo">
      <h2>PAN Docs</h2>
    </div>
    <div class="nav-section">
      <h3>Components</h3>
      <ul class="nav-list">
`;

  for (const doc of allDocs) {
    const name = doc.classes[0]?.name || path.parse(doc.fileName).name;
    const slug = doc.fileName.replace('.mjs', '');
    html += `        <li><a href="api/${slug}.html">${name}</a></li>\n`;
  }

  html += `
      </ul>
    </div>
  </nav>

  <main class="content">
    <header class="page-header">
      <h1>PAN API Documentation</h1>
      <p>Complete reference for all PAN components and APIs</p>
    </header>

    <section class="section">
      <h2>Components</h2>
      <div class="components-grid">
`;

  for (const doc of allDocs) {
    const cls = doc.classes[0];
    if (!cls) continue;

    const slug = doc.fileName.replace('.mjs', '');
    const shortDesc = cls.description.split('\n')[0];

    html += `
        <div class="component-card">
          <h3><a href="api/${slug}.html">${cls.name}</a></h3>
          <p>${shortDesc}</p>
        </div>
`;
  }

  html += `
      </div>
    </section>
  </main>
</body>
</html>
`;

  return html;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Main
 */
function main() {
  console.log('🔨 Generating PAN documentation...\n');

  // Create docs directory
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Scan all source files
  const allDocs = [];

  for (const sourceDir of SOURCE_DIRS) {
    const files = fs.readdirSync(sourceDir)
      .filter(f => f.endsWith('.mjs') && !f.includes('.test.'))
      .map(f => path.join(sourceDir, f));

    for (const file of files) {
      console.log(`📄 Processing: ${path.relative(ROOT_DIR, file)}`);
      const docs = extractDocs(file);

      if (docs.classes.length > 0 || docs.functions.length > 0) {
        allDocs.push(docs);

        // Generate component HTML
        const html = generateComponentHTML(docs);
        const outputFile = path.join(DOCS_DIR, path.basename(file).replace('.mjs', '.html'));
        fs.writeFileSync(outputFile, html);
        console.log(`   ✓ Generated: ${path.relative(ROOT_DIR, outputFile)}`);
      }
    }
  }

  // Generate index
  const indexHTML = generateIndexHTML(allDocs);
  const indexFile = path.join(ROOT_DIR, 'docs', 'index.html');
  fs.writeFileSync(indexFile, indexHTML);
  console.log(`\n✓ Generated index: ${path.relative(ROOT_DIR, indexFile)}`);

  console.log(`\n✅ Documentation generated successfully!`);
  console.log(`   Total components: ${allDocs.length}`);
  console.log(`   Output: ${path.relative(ROOT_DIR, DOCS_DIR)}`);
}

main();
