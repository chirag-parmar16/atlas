import { test, expect } from '@playwright/test';

test.describe('Atlas Dashboard Visual Regression', () => {
    test('Dashboard Welcome Screen', async ({ page }) => {
        // Since we are testing the built GUI, we point to the local server
        // In a real scenario, we'd spawn the electron app or serve the dist folder
        await page.goto('/');

        // Wait for the animation to finish
        await page.waitForTimeout(500);

        // Take a screenshot and compare with baseline
        await expect(page).toHaveScreenshot('welcome-screen.png', {
            maxDiffPixels: 100,
            threshold: 0.2
        });
    });

    test('Project Explorer Tree', async ({ page }) => {
        await page.goto('/');
        // Mocking/Stubbing would happen here in a real test environment
        await page.click('#gui-scan-btn');
        await page.waitForSelector('.tree-node');

        await expect(page.locator('#gui-project-list')).toHaveScreenshot('explorer-tree.png');
    });
});
