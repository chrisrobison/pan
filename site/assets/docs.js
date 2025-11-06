/**
 * Documentation JavaScript
 */

// Initialize syntax highlighting
document.addEventListener('DOMContentLoaded', () => {
  // Highlight code blocks
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }

  // Load docs menu
  loadDocsMenu();

  // Add copy buttons to code blocks
  addCopyButtons();

  // Smooth scroll for anchor links
  enableSmoothScroll();
});

/**
 * Load documentation menu from index.json
 */
async function loadDocsMenu() {
  const menuEl = document.getElementById('docs-menu');
  if (!menuEl) return;

  try {
    const response = await fetch('index.json');
    const docs = await response.json();

    let html = '';
    const categories = Object.keys(docs).sort();

    for (const category of categories) {
      const categoryDocs = docs[category].sort((a, b) => a.title.localeCompare(b.title));

      html += `<div class="docs-menu-section">`;
      html += `<h4>${category}</h4>`;

      for (const doc of categoryDocs) {
        const isActive = window.location.pathname.endsWith(doc.path);
        const activeClass = isActive ? 'active' : '';
        html += `<a href="${doc.path}" class="${activeClass}">${doc.title}</a>`;
      }

      html += `</div>`;
    }

    menuEl.innerHTML = html;
  } catch (error) {
    console.error('Failed to load docs menu:', error);
  }
}

/**
 * Add copy buttons to code blocks
 */
function addCopyButtons() {
  const codeBlocks = document.querySelectorAll('pre code');

  codeBlocks.forEach(codeBlock => {
    const pre = codeBlock.parentElement;
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');

    button.addEventListener('click', async () => {
      const code = codeBlock.textContent;

      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        button.textContent = 'Failed';
      }
    });

    pre.style.position = 'relative';
    pre.appendChild(button);
  });

  // Add styles for copy button
  const style = document.createElement('style');
  style.textContent = `
    .copy-button {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .copy-button.copied {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.4);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Enable smooth scrolling for anchor links
 */
function enableSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Update URL without triggering navigation
        history.pushState(null, null, href);
      }
    });
  });
}

/**
 * Generate table of contents from headers
 */
function generateTableOfContents() {
  const content = document.querySelector('.docs-content');
  if (!content) return;

  const headers = content.querySelectorAll('h2, h3');
  if (headers.length === 0) return;

  const toc = document.createElement('div');
  toc.className = 'docs-toc';
  toc.innerHTML = '<h4>On This Page</h4><ul></ul>';

  const list = toc.querySelector('ul');

  headers.forEach((header, index) => {
    // Add ID to header if it doesn't have one
    if (!header.id) {
      header.id = `heading-${index}`;
    }

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${header.id}`;
    a.textContent = header.textContent;

    if (header.tagName === 'H3') {
      a.style.paddingLeft = '1rem';
    }

    li.appendChild(a);
    list.appendChild(li);
  });

  // Insert TOC after breadcrumb
  const breadcrumb = document.querySelector('.docs-breadcrumb');
  if (breadcrumb) {
    breadcrumb.after(toc);
  }
}
