import { test, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL } from 'url';

const fileUrl = (rel: string) => pathToFileURL(path.resolve(__dirname, '..', rel)).toString();

test.describe('02-todos-and-inspector.html', () => {
  test('renders, adds/toggles/deletes, and logs in inspector', async ({ page }) => {
    await page.goto(fileUrl('examples/02-todos-and-inspector.html'));

    // Todo list renders basic UI
    const list = page.locator('todo-list');
    await expect(list).toBeVisible();
    await expect(list.locator('form#f')).toBeVisible();
    await expect(list.locator('text=No tasks yet.')).toBeVisible();

    // Add a task
    await list.locator('#title').fill('Buy milk');
    await list.locator('form#f button').click();
    await expect(list.locator('ul li')).toHaveCount(1);
    await expect(list.locator('ul li .t')).toHaveText('Buy milk');

    // Toggle done
    const cb = list.locator('ul li input[type=checkbox]');
    await cb.check();
    await expect(list.locator('ul li')).toHaveClass(/done/);

    // Delete
    await list.locator('ul li .del').click();
    await expect(list.locator('ul li')).toHaveCount(0);
    await expect(list.locator('text=No tasks yet.')).toBeVisible();

    // Inspector shows traffic
    const insp = page.locator('pan-inspector');
    await expect(insp).toBeVisible();
    // Wait a moment for inspector to render entries
    await page.waitForTimeout(100);
    // Inspector uses a table in shadow DOM; check rows exist and include topics
    const rows = insp.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    const topicsText = await insp.locator('table').innerText();
    expect(topicsText).toMatch(/todos\.change/);
    expect(topicsText).toMatch(/todos\.state/);
  });
});
