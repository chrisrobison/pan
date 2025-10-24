#!/usr/bin/env node
// Runs the conformance page in Playwright headless and writes badge JSON+SVG
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const pagePath = resolve(root, 'conformance', 'index.html');
const url = 'file://' + pagePath;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
// Wait for summary to render
await page.waitForSelector('#summary');
// Extract results
const result = await page.evaluate(()=>{
  const text = document.getElementById('summary')?.textContent||'';
  const m = text.match(/(\d+) passed,\s*(\d+) failed/);
  const passed = m? Number(m[1]): 0; const failed = m? Number(m[2]): 0;
  return { passed, failed };
});
await browser.close();

const status = {
  status: result.failed === 0 ? 'pass' : 'fail',
  passed: result.passed,
  failed: result.failed,
  ts: new Date().toISOString()
};
const outJson = resolve(root, 'conformance', 'badge.json');
writeFileSync(outJson, JSON.stringify(status, null, 2));
console.log('Wrote', outJson, status);

// Generate a simple SVG badge
const label = 'PAN v1';
const msg = status.status.toUpperCase();
const color = status.status === 'pass' ? '#4c1' : '#e05d44';
const svg = `<?xml version="1.0"?><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"140\" height=\"20\" role=\"img\" aria-label=\"${label}: ${msg}\"><linearGradient id=\"b\" x2=\"0\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".7\"/><stop offset=\".1\" stop-color=\"#aaa\" stop-opacity=\".1\"/><stop offset=\".9\" stop-opacity=\".3\"/><stop offset=\"1\" stop-opacity=\".5\"/></linearGradient><mask id=\"a\"><rect width=\"140\" height=\"20\" rx=\"3\" fill=\"#fff\"/></mask><g mask=\"url(#a)\"><rect width=\"70\" height=\"20\" fill=\"#555\"/><rect x=\"70\" width=\"70\" height=\"20\" fill=\"${color}\"/><rect width=\"140\" height=\"20\" fill=\"url(#b)\"/></g><g fill=\"#fff\" text-anchor=\"middle\" font-family=\"DejaVu Sans,Verdana,Geneva,sans-serif\" font-size=\"11\"><text x=\"35\" y=\"15\" fill=\"#010101\" fill-opacity=\".3\">${label}</text><text x=\"35\" y=\"14\">${label}</text><text x=\"105\" y=\"15\" fill=\"#010101\" fill-opacity=\".3\">${msg}</text><text x=\"105\" y=\"14\">${msg}</text></g></svg>`;
const outSvg = resolve(root, 'badges', 'pan-v1-status.svg');
writeFileSync(outSvg, svg);
console.log('Wrote', outSvg);

