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
    disabledTabs?: string[];
}

/**
 * The complete ordered suite of Atlas UI components to inject.
 */
const ATLAS_UI_MAP: Record<string, string> = {
    'shell': UI_SHELL,
    'recorder': RECORDER,
    'links': LINKS,
    'console': CONSOLE_TOOL,
    'networks': NETWORKS,
    'application': APPLICATION,
    'storage': STORAGE,
    'stability': STABILITY, // alias for scalability
    'scalability': STABILITY,
    'security': SECURITY_MONITOR,
    'extras': EXTRAS,
    'loader': LOADER
};

function getInjectedScripts(disabledTabs: string[] = []): string[] {
    const disabled = new Set(disabledTabs.map(t => t.toLowerCase()));
    const scripts: string[] = [];

    // Core components, always injected
    scripts.push(ATLAS_UI_MAP['shell']);
    scripts.push(ATLAS_UI_MAP['loader']);

    // Canonical tab mapping with aliases
    const tabs = [
        { key: 'recorder', aliases: ['recorder', 'recording'] },
        { key: 'links', aliases: ['links', 'link'] },
        { key: 'console', aliases: ['console'] },
        { key: 'networks', aliases: ['networks', 'network'] },
        { key: 'application', aliases: ['application'] },
        { key: 'storage', aliases: ['storage'] },
        { key: 'stability', aliases: ['stability', 'scalability', 'stress'] },
        { key: 'security', aliases: ['security', 'monitor'] },
        { key: 'extras', aliases: ['extras', 'more'] }
    ];

    tabs.forEach(tab => {
        const isTabDisabled = tab.aliases.some(alias => disabled.has(alias));
        if (!isTabDisabled) {
            const script = ATLAS_UI_MAP[tab.key];
            if (script) {
                scripts.push(script);
            }
        }
    });

    return scripts;
}

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
    const scripts = getInjectedScripts(config.disabledTabs);

    // 1. Persistent hook for all future navigations (hard loads)
    await page.evaluateOnNewDocument(atlasPayloadRunner, scripts, config);

    // 2. Immediate injection for the current page context
    await page.evaluate(atlasPayloadRunner, scripts, config);
}
