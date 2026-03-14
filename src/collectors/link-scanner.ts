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
        // Step 1: Extract all links from the page
        const extractedLinks = await targetPage.evaluate((): ExtractedLink[] => {
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => {
                    const hrefAttr = a.getAttribute('href') || '';
                    const absoluteHref = (a as HTMLAnchorElement).href;
                    return {
                        attr: hrefAttr,
                        href: absoluteHref,
                        text: a.textContent?.trim() || ''
                    };
                })
                .filter(l => {
                    // Skip fragments and non-network links
                    if (!l.attr || l.attr.startsWith('#') || l.attr.startsWith('mailto:') || 
                        l.attr.startsWith('tel:') || l.attr.startsWith('javascript:') || 
                        l.attr.startsWith('data:')) {
                        return false;
                    }
                    // Only validate http/https links
                    return l.href.startsWith('http');
                })
                .map(l => ({
                    // Normalize: remove fragments from the absolute URL
                    href: l.href.split('#')[0],
                    text: l.text
                }));
        });

        // Deduplicate
        const uniqueLinks = Array.from(new Set(extractedLinks.map(l => l.href)))
            .map(href => extractedLinks.find(l => l.href === href)!);

        // Step 2: Validate links INSIDE the browser context (Native Session)
        // We use evaluate to run fetch() inside the page. This automatically uses
        // the browser's cookies, session, and identity. No assumptions needed.
        const validationResults = await targetPage.evaluate(async (links: ExtractedLink[]) => {
            const results: { href: string, text: string, status: number, ok: boolean, error?: string }[] = [];
            
            for (const link of links) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);

                    // Native browser fetch inherits all cookies and auth state
                    const res = await fetch(link.href, { 
                        method: 'HEAD', 
                        signal: controller.signal,
                        mode: 'no-cors' // Use no-cors to avoid preflight issues for external links
                    }).catch(() => fetch(link.href, { 
                        method: 'GET', 
                        signal: controller.signal 
                    }));

                    clearTimeout(timeout);
                    results.push({
                        href: link.href,
                        text: link.text,
                        status: res.status,
                        ok: res.type === 'opaque' || res.ok // opaque means it's an external link that succeeded without CORS
                    });
                } catch (e) {
                    results.push({
                        href: link.href,
                        text: link.text,
                        status: 0,
                        ok: false,
                        error: (e as Error).message
                    });
                }
            }
            return results;
        }, uniqueLinks);

        const accessibleLinks: ExtractedLink[] = [];

        for (const res of validationResults) {
            if (res.ok) {
                accessibleLinks.push({ href: res.href, text: res.text });
                linkStatusCache.set(res.href, { ok: true, timestamp: Date.now() });
            } else {
                linkStatusCache.set(res.href, { ok: false, timestamp: Date.now() });
                pipeline.emit('violation', {
                    source: 'Scalability',
                    message: `Broken Link detected: ${res.href} (Status: ${res.status || 'Connection Failed'})`,
                    level: 1, // WARN
                    timestamp: Date.now(),
                    url: targetPage.url()
                });
            }
        }

        // Push accessible links to UI
        if (!mainWindow.isClosed()) {
            await mainWindow.evaluate((ls: ExtractedLink[], tId: string) => {
                const atlasWindow = window as unknown as Window & { updateLinks?: (links: ExtractedLink[], tabId: string) => void };
                if (atlasWindow.updateLinks) {
                    atlasWindow.updateLinks(ls, tId);
                }
            }, accessibleLinks, tabId);
        }

    } catch (e) {
        const err = e as Error;
        if (!err.message.includes('Target closed') && !err.message.includes('Session closed')) {
            console.error('[Atlas:LinkScanner] In-browser validation failed:', err.message);
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
