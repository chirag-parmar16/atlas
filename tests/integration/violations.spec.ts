import { test, expect } from '@playwright/test';

test.describe('Atlas Integration: Violation Reporting', () => {
    test.beforeEach(async ({ page }) => {
        // Go to the dashboard
        await page.goto('/');
    });

    test('should report PII leaks during navigation', async ({ page }) => {
        // Mock a navigation that triggers a PII leak
        // Note: In real environment, this would be an actual navigation 
        // through the Atlas proxy. Here we simulate the result in the UI.
        
        await page.click('#gui-scan-btn');
        
        // Wait for results to appear
        await page.waitForSelector('.violation-item');
        
        const violations = await page.locator('.violation-item').count();
        expect(violations).toBeGreaterThan(0);
        
        const firstViolationText = await page.locator('.violation-item').first().textContent();
        expect(firstViolationText).toContain('PII');
    });

    test('should reflect chaos injection in the UI', async ({ page }) => {
        await page.click('#gui-settings-btn');
        await page.check('#chaos-toggle');
        await page.fill('#error-rate-input', '100');
        await page.click('#save-settings');
        
        await page.click('#gui-scan-btn');
        
        // Check for 500 error violation
        await page.waitForSelector('.violation-item');
        const contents = await page.locator('.violation-list').textContent();
        expect(contents).toContain('500');
    });
});
