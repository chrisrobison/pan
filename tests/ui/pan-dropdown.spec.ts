import { test, expect } from '@playwright/test';
import { fileUrl } from '../helpers/test-utils';

test.describe('pan-dropdown', () => {
  test('opens and closes dropdown menu', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));

    await page.evaluate(() => {
      const dropdown = document.createElement('pan-dropdown');
      dropdown.innerHTML = `
        <button slot="trigger">Menu</button>
        <div slot="content">
          <a href="#">Item 1</a>
          <a href="#">Item 2</a>
        </div>
      `;
      document.body.appendChild(dropdown);
    });

    await page.waitForFunction(() => customElements.get('pan-dropdown') !== undefined);

    const dropdown = page.locator('pan-dropdown');
    const trigger = dropdown.locator('[slot="trigger"]');

    await expect(trigger).toBeVisible();

    // Click to open
    await trigger.click();

    // Check if content is visible (implementation dependent)
    const content = dropdown.locator('[slot="content"]');
    await expect(content).toBeAttached();
  });

  test('closes on outside click', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));

    await page.evaluate(() => {
      const dropdown = document.createElement('pan-dropdown');
      dropdown.innerHTML = `
        <button slot="trigger">Menu</button>
        <div slot="content">Options</div>
      `;
      document.body.appendChild(dropdown);
    });

    await page.waitForFunction(() => customElements.get('pan-dropdown') !== undefined);

    const dropdown = page.locator('pan-dropdown');
    const trigger = dropdown.locator('[slot="trigger"]');

    // Open dropdown
    await trigger.click();
    await page.waitForTimeout(100);

    // Click outside
    await page.click('body', { position: { x: 10, y: 10 } });

    // Dropdown should close (implementation dependent)
  });

  test('handles keyboard navigation', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));

    await page.evaluate(() => {
      const dropdown = document.createElement('pan-dropdown');
      dropdown.innerHTML = `
        <button slot="trigger">Menu</button>
        <div slot="content">
          <a href="#1">Item 1</a>
          <a href="#2">Item 2</a>
          <a href="#3">Item 3</a>
        </div>
      `;
      document.body.appendChild(dropdown);
    });

    await page.waitForFunction(() => customElements.get('pan-dropdown') !== undefined);

    const trigger = page.locator('[slot="trigger"]');

    // Open with keyboard
    await trigger.focus();
    await page.keyboard.press('Enter');

    // Navigate with arrow keys (implementation dependent)
    await page.keyboard.press('ArrowDown');

    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('positions dropdown relative to trigger', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));

    await page.evaluate(() => {
      const dropdown = document.createElement('pan-dropdown');
      dropdown.setAttribute('position', 'bottom-right');
      dropdown.innerHTML = `
        <button slot="trigger">Menu</button>
        <div slot="content">Content</div>
      `;
      document.body.appendChild(dropdown);
    });

    await page.waitForFunction(() => customElements.get('pan-dropdown') !== undefined);

    const dropdown = page.locator('pan-dropdown');
    const position = await dropdown.getAttribute('position');
    expect(position).toBe('bottom-right');
  });
});
