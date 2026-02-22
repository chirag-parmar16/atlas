/**
 * Atlas UI — Enhanced Injection Module
 * 
 * Handles the secure delivery of the Atlas UI suite into the target browser page.
 * Provides double-injection guards, error boundaries, and centralized
 * UI payload management.
 */

import { Page } from 'puppeteer-core';
import {
    UI_SHELL,
    RECORDER,
    LINKS,
    CONSOLE_TOOL,
    NETWORKS,
    APPLICATION,
    STORAGE,
    STABILITY,
    SECURITY_MONITOR,
    EXTRAS,
    LOADER
} from './components';

export interface UIConfig {
    domain: string;
    port: number;
}

/**
 * The complete ordered suite of Atlas UI components to inject.
 */
const ATLAS_UI_SUITE = [
    UI_SHELL,
    RECORDER,
    LINKS,
    CONSOLE_TOOL,
    NETWORKS,
    APPLICATION,
    STORAGE,
    STABILITY,
    SECURITY_MONITOR,
    EXTRAS,
    LOADER
];

/**
 * The core injection payload that runs inside the browser context.
 * We ship it as a unified function rather than interpolating strings
 * directly to ensure CSP compliance and execution safety.
 */
function atlasPayloadRunner(toolScripts: string[], config: UIConfig) {
    try {
        // 1. Double-Injection Guard
        if ((window as any).__ATLAS_LOADED__) return;
        (window as any).__ATLAS_LOADED__ = true;

        // 2. Persist config for UI components
        (window as any).__ATLAS_CONFIG__ = config;

        console.log("%c[Atlas] Injecting UI Suite...", "color: #10b981; font-weight: bold;");

        // 3. Execution Boundary
        toolScripts.forEach((script: string, index: number) => {
            try {
                // Execute component builder
                new Function(script)();
            } catch (e: any) {
                console.error(`[Atlas UI] Component execution failed (index: ${index}):`, e.message);
                if ((window as any).Atlas && (window as any).Atlas.reportViolation) {
                    (window as any).Atlas.reportViolation('Atlas UI', `Component ${index} failed: ${e.message}`, 2);
                }
            }
        });

        console.log("%c[Atlas] UI Suite Active.", "color: #10b981;");
    } catch (criticalError: any) {
        console.error('[Atlas UI] Critical Injection Failure:', criticalError);
    }
}

/**
 * Injects the Atlas UI suite into a given Puppeteer page.
 * Sets up both the evaluateOnNewDocument hook (for new navigations)
 * and an immediate execution (for the current state).
 */
export async function injectAtlasUI(page: Page, config: UIConfig): Promise<void> {
    // 1. Persistent hook for all future navigations (hard loads)
    await page.evaluateOnNewDocument(atlasPayloadRunner, ATLAS_UI_SUITE, config);

    // 2. Immediate injection for the current page context
    // This handles cases where the page is already loaded or being attached to dynamically.
    await page.evaluate(atlasPayloadRunner, ATLAS_UI_SUITE, config);
}
