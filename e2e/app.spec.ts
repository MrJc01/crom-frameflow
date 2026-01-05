import { test, expect } from '@playwright/test';

test.describe('FrameFlow App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application', async ({ page }) => {
    // Check that the app title is visible
    await expect(page.locator('text=FrameFlow')).toBeVisible();
  });

  test('should display the main layout', async ({ page }) => {
    // Header should be present
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Sidebar should be present
    await expect(page.locator('text=Assets')).toBeVisible();

    // Viewport area should be present
    const viewport = page.locator('#viewport-container, [class*="viewport"]').first();
    await expect(viewport).toBeVisible();
  });

  test('should have functional navigation buttons', async ({ page }) => {
    // Settings button should be clickable
    const settingsButton = page.locator('button:has-text("Settings")');
    await expect(settingsButton).toBeVisible();
    
    // Effects button should be present
    const effectsButton = page.locator('button:has-text("Effects")');
    await expect(effectsButton).toBeVisible();

    // Search button should be present
    const searchButton = page.locator('button:has-text("Search")');
    await expect(searchButton).toBeVisible();
  });

  test('should open Settings modal', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    
    // Modal should appear
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Close the modal
    await page.click('[aria-label="Close"], button:has(svg.lucide-x)');
  });

  test('should open Search modal with Cmd+K', async ({ page }) => {
    // Press Cmd+K or Ctrl+K
    await page.keyboard.press('Control+k');
    
    // Search modal should appear
    await expect(page.getByPlaceholder('Search assets')).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
  });
});
