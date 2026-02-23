/**
 * Atlas UI — Enhanced Injection Module
 * 
 * Handles the secure delivery of the Atlas UI suite into the target browser page.
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

const ATLAS_UI_MAP: Record<string, string> = {
    'shell': UI_SHELL,
    'recorder': RECORDER,
    'links': LINKS,
    'console': CONSOLE_TOOL,
    'networks': NETWORKS,
    'application': APPLICATION,
    'storage': STORAGE,
    'stability': STABILITY,
    'scalability': STABILITY,
    'security': SECURITY_MONITOR,
    'extras': EXTRAS,
    'loader': LOADER
};

function getInjectedScripts(disabledTabs: string[] = []): string[] {
    const disabled = new Set(disabledTabs.map(t => t.toLowerCase()));
    const scripts: string[] = [];
    scripts.push(ATLAS_UI_MAP['shell']);
    scripts.push(ATLAS_UI_MAP['loader']);
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
            if (script) scripts.push(script);
        }
    });
    return scripts;
}

function atlasPayloadRunner(toolScripts: string[], config: UIConfig) {
    try {
        if ((window as any).__ATLAS_LOADED__) return;
        (window as any).__ATLAS_LOADED__ = true;
        (window as any).__ATLAS_CONFIG__ = config;
        toolScripts.forEach((script: string) => {
            try {
                new Function(script)();
            } catch (e: any) { }
        });
    } catch (e: any) { }
}

export async function injectAtlasUI(page: Page, config: UIConfig): Promise<void> {
    const scripts = getInjectedScripts(config.disabledTabs);
    await page.evaluateOnNewDocument(atlasPayloadRunner, scripts, config);
    await page.evaluate(atlasPayloadRunner, scripts, config);
}
