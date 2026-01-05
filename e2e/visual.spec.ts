import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to settle
    await page.waitForLoadState('networkidle');
    // Hide blinking cursors or animations if possible to make tests stable
    await page.addStyleTag({ content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `});
  });

  test('full app layout', async ({ page }) => {
    await expect(page).toHaveScreenshot('app-layout.png');
  });

  test('timeline component', async ({ page }) => {
    const timeline = page.locator('[class*="timeline"], [class*="Timeline"]').first();
    await expect(timeline).toBeVisible();
    await expect(timeline).toHaveScreenshot('timeline-component.png');
  });

  test('asset library', async ({ page }) => {
    const assets = page.locator('text=Assets').locator('..').locator('..'); // Heuristic to find container
    await expect(assets).toBeVisible();
    await expect(assets).toHaveScreenshot('asset-library.png');
  });

  test('settings modal', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveScreenshot('settings-modal.png');
  });

  test('search modal', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const modal = page.getByPlaceholder('Search assets').locator('..').locator('..');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveScreenshot('search-modal.png');
  });
});
