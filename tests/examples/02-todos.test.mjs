/**
 * 02-todos-and-inspector.html integration test
 * Tests the complete todo app with inspector
 */

import { chromium } from '@playwright/test';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

let browser, page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe('02-todos-and-inspector.html', () => {
  test('renders, adds/toggles/deletes, and logs in inspector', async () => {
    await page.goto(fileUrl('examples/02-todos-and-inspector.html'));

    // Todo list renders basic UI
    const listExists = await page.evaluate(() => {
      return document.querySelector('todo-list') !== null;
    });
    expect(listExists).toBeTruthy();

    // Check form exists
    const formExists = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      if (!list || !list.shadowRoot) return false;
      return list.shadowRoot.querySelector('form#f') !== null;
    });
    expect(formExists).toBeTruthy();

    // Check "No tasks yet" message
    const noTasksText = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      if (!list || !list.shadowRoot) return '';
      const muted = list.shadowRoot.querySelector('.muted');
      return muted ? muted.textContent : '';
    });
    expect(noTasksText).toContain('No tasks yet');

    // Add a task
    await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const input = list.shadowRoot.querySelector('#title');
      const form = list.shadowRoot.querySelector('form#f');
      input.value = 'Buy milk';
      form.dispatchEvent(new Event('submit'));
    });

    // Wait a moment for the task to be added
    await page.waitForTimeout(100);

    // Check task was added
    const taskCount = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const items = list.shadowRoot.querySelectorAll('ul li');
      return items.length;
    });
    expect(taskCount).toBe(1);

    // Check task text
    const taskText = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const taskEl = list.shadowRoot.querySelector('ul li .t');
      return taskEl ? taskEl.textContent : '';
    });
    expect(taskText).toBe('Buy milk');

    // Toggle done
    await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const checkbox = list.shadowRoot.querySelector('ul li input[type=checkbox]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    });

    await page.waitForTimeout(50);

    // Check task is marked done
    const isDone = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const li = list.shadowRoot.querySelector('ul li');
      return li.classList.contains('done');
    });
    expect(isDone).toBeTruthy();

    // Delete task
    await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const deleteBtn = list.shadowRoot.querySelector('ul li .del');
      deleteBtn.click();
    });

    await page.waitForTimeout(50);

    // Check task was deleted
    const taskCountAfterDelete = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      const items = list.shadowRoot.querySelectorAll('ul li');
      return items.length;
    });
    expect(taskCountAfterDelete).toBe(0);

    // Check "No tasks yet" message appears again
    const noTasksAfterDelete = await page.evaluate(() => {
      const list = document.querySelector('todo-list');
      if (!list || !list.shadowRoot) return '';
      const muted = list.shadowRoot.querySelector('.muted');
      return muted ? muted.textContent : '';
    });
    expect(noTasksAfterDelete).toContain('No tasks yet');

    // Inspector shows traffic
    const inspectorExists = await page.evaluate(() => {
      return document.querySelector('pan-inspector') !== null;
    });
    expect(inspectorExists).toBeTruthy();

    // Wait a moment for inspector to render entries
    await page.waitForTimeout(100);

    // Check inspector has rows
    const hasRows = await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      if (!inspector || !inspector.shadowRoot) return false;
      const rows = inspector.shadowRoot.querySelectorAll('table tbody tr');
      return rows.length > 0;
    });
    expect(hasRows).toBeTruthy();

    // Check inspector shows todo topics
    const topicsText = await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      if (!inspector || !inspector.shadowRoot) return '';
      const table = inspector.shadowRoot.querySelector('table');
      return table ? table.innerText : '';
    });
    expect(topicsText).toMatch(/todos\.change/);
    expect(topicsText).toMatch(/todos\.state/);
  });
});
