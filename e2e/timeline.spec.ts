import { test, expect } from '@playwright/test';

test.describe('Timeline Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display timeline area', async ({ page }) => {
    // Timeline should be visible at the bottom
    const timeline = page.locator('[class*="timeline"], [class*="Timeline"]').first();
    await expect(timeline).toBeVisible();
  });

  test('should have playback controls', async ({ page }) => {
    // Play/Pause button should exist
    const playButton = page.locator('button:has(svg.lucide-play), button:has(svg.lucide-pause)').first();
    await expect(playButton).toBeVisible();
  });

  test('should display timeline tracks', async ({ page }) => {
    // Wait for timeline to load
    await page.waitForTimeout(1000);
    
    // Track headers or track areas should be visible
    const tracks = page.locator('[class*="track"], [class*="Track"]').first();
    await expect(tracks).toBeVisible();
  });
});
