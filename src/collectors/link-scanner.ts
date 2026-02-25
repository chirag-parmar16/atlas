import { Page } from 'puppeteer-core';
import { Pipeline } from '../pipeline/pipeline';

// Cache to avoid aggressive link re-checking (valid for 5 mins)
const linkStatusCache = new Map<string, { ok: boolean, timestamp: number }>();
const CACHE_TTL_MS = 300000; // 5 minutes

export interface ExtractedLink {
    href: string;
    text: string;
}

/**
 * Scans a single page for all HTTP links and validates them.
 * Emits accessibility results to the UI and broken links as violations to the engine.
 */
export async function scanLinksForPage(
    targetPage: Page,
    tabId: string,
    mainWindow: Page,
    pipeline: Pipeline,
    userAgent: string
): Promise<void> {
    if (!targetPage || targetPage.isClosed()) return;

    try {
        const rawLinks = await targetPage.evaluate((): ExtractedLink[] => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({
                    href: (a as HTMLAnchorElement).href,
                    text: a.textContent?.trim() || ''
                }))
                .filter(l => l.href.startsWith('http')); // Only validate HTTP links
        });

        // Deduplicate
        const uniqueLinks = Array.from(new Set(rawLinks.map(l => l.href)))
            .map(href => rawLinks.find(l => l.href === href)!);

        const accessibleLinks: ExtractedLink[] = [];

        for (const link of uniqueLinks) {
            const cached = linkStatusCache.get(link.href);

            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                if (cached.ok) accessibleLinks.push(link);
                continue;
            }

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(link.href, {
                    method: 'HEAD',
                    signal: controller.signal,
                    headers: { 'User-Agent': userAgent }
                }).catch(() => fetch(link.href, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { 'User-Agent': userAgent }
                }));

                clearTimeout(timeout);

                const ok = res.ok;
                linkStatusCache.set(link.href, { ok, timestamp: Date.now() });

                if (ok) {
                    accessibleLinks.push(link);
                } else {
                    pipeline.emit('violation', {
                        source: 'Scalability',
                        message: `Broken Link detected: ${link.href} (Status: ${res.status})`,
                        level: 1, // WARN
                        timestamp: Date.now(),
                        url: targetPage.url()
                    });
                }
            } catch (e) {
                linkStatusCache.set(link.href, { ok: false, timestamp: Date.now() });
                pipeline.emit('violation', {
                    source: 'Scalability',
                    message: `Broken Link detected: ${link.href} (Connection Failed)`,
                    level: 1, // WARN
                    timestamp: Date.now(),
                    url: targetPage.url()
                });
            }
        }

        // Push accessible links to UI
        if (!mainWindow.isClosed()) {
            await mainWindow.evaluate((ls: ExtractedLink[], tId: string) => {
                // Define the expected interface for the host UI window
                const atlasWindow = window as unknown as Window & { updateLinks?: (links: ExtractedLink[], tabId: string) => void };
                if (atlasWindow.updateLinks) {
                    atlasWindow.updateLinks(ls, tId);
                }
            }, accessibleLinks, tabId);
        }

    } catch (e) {
        const err = e as Error;
        if (!err.message.includes('Target closed') && !err.message.includes('Session closed')) {
            console.error('[Atlas:LinkScanner] Link scan evaluation failed:', err.message);
        }
    }
}

/**
 * Initializes continuous link scanning logic for the browser session.
 * Wires into pipeline navigation events and starts a periodic full-sweep interval.
 * 
 * @param getActivePages Function returning an iterable of all active Puppeteer pages
 * @param pageToTabIdMap Map linking pages to their corresponding tabId strings
 * @param getMainWindow Function returning the main HUD page
 * @param pipeline Event bus
 * @param userAgent User agent to use for HEAD requests
 * @returns Cleanup function
 */
export function startLinkScanner(
    getActivePages: () => Iterable<Page>,
    pageToTabIdMap: Map<Page, string>,
    getMainWindow: () => Page | null,
    pipeline: Pipeline,
    userAgent: string
): () => void {

    // Subscribe to navigation events to trigger an immediate scan for the navigated page
    const navScanListener = (entry: { url: string }) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        // Give the page a moment to render DOM before scanning
        setTimeout(() => {
            for (const p of getActivePages()) {
                if (p.url() === entry.url && !p.isClosed()) {
                    const tabId = pageToTabIdMap.get(p) || '';
                    scanLinksForPage(p, tabId, mainWindow, pipeline, userAgent);
                    break;
                }
            }
        }, 2000); // 2 second delay after navigation
    };

    pipeline.on('navigation', navScanListener);

    // Periodic sweep for all pages (e.g. for dynamic SPA content)
    const periodicScan = async () => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        for (const p of getActivePages()) {
            if (!p.isClosed()) {
                const tabId = pageToTabIdMap.get(p) || '';
                await scanLinksForPage(p, tabId, mainWindow, pipeline, userAgent);
            }
        }
    };

    const intervalId = setInterval(periodicScan, 60000);

    return () => {
        clearInterval(intervalId);
        pipeline.off('navigation', navScanListener);
    };
}
