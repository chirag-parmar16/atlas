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
        // Step 1: Extract and Categorize ALL links from the page for the UI
        const categorizedLinks = await targetPage.evaluate(() => {
            const baseUrl = window.location.origin;
            const links = Array.from(document.querySelectorAll('a[href]'));
            
            const results = {
                internal: [] as { href: string, text: string }[],
                external: [] as { href: string, text: string }[],
                fragments: [] as { href: string, text: string }[]
            };

            links.forEach(a => {
                const hrefAttr = a.getAttribute('href') || '';
                const absoluteHref = (a as HTMLAnchorElement).href;
                const text = a.textContent?.trim() || '';

                // 1. Fragments
                if (hrefAttr.startsWith('#')) {
                    results.fragments.push({ href: hrefAttr, text });
                    return;
                }

                // 2. Protocols to skip
                if (hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:') || 
                    hrefAttr.startsWith('javascript:') || hrefAttr.startsWith('data:')) {
                    return;
                }

                // 3. Network links (http/https)
                if (absoluteHref.startsWith('http')) {
                    const url = absoluteHref.split('#')[0];
                    if (absoluteHref.startsWith(baseUrl)) {
                        results.internal.push({ href: url, text });
                    } else {
                        results.external.push({ href: url, text });
                    }
                }
            });

            return results;
        });

        // Debug log (shown in terminal)
        console.log(`[Atlas:LinkScanner] Extracted links for tab ${tabId}: ${categorizedLinks.internal.length} Internal, ${categorizedLinks.external.length} External, ${categorizedLinks.fragments.length} Fragments`);

        // Step 2: Extract unique network links for validation
        const networkLinks = [...categorizedLinks.internal, ...categorizedLinks.external];
        const uniqueNetworkLinks = Array.from(new Set(networkLinks.map(l => l.href)))
            .map(href => networkLinks.find(l => l.href === href)!);

        // Step 3: Validate links INSIDE the browser context (Native Session)
        // We use .then() and Promise.all instead of async/await to avoid __awaiter issues
        const validationResults = await targetPage.evaluate((links) => {
            return Promise.all(links.map((link) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);

                return fetch(link.href, { 
                    method: 'HEAD', 
                    signal: controller.signal,
                    mode: 'no-cors' 
                })
                .then((res) => {
                    clearTimeout(timeout);
                    return { href: link.href, status: res.status, ok: res.type === 'opaque' || res.ok };
                })
                .catch(() => {
                    // Failover to GET if HEAD failed
                    return fetch(link.href, { 
                        method: 'GET', 
                        signal: controller.signal 
                    })
                    .then((res) => {
                        clearTimeout(timeout);
                        return { href: link.href, status: res.status, ok: res.ok };
                    })
                    .catch(() => {
                        clearTimeout(timeout);
                        return { href: link.href, status: 0, ok: false };
                    });
                });
            }));
        }, uniqueNetworkLinks);

        // Step 4: Emit Violations for Broken Links
        for (const res of validationResults) {
            if (!res.ok) {
                linkStatusCache.set(res.href, { ok: false, timestamp: Date.now() });
                pipeline.emit('violation', {
                    source: 'Scalability',
                    message: `Broken Link detected: ${res.href} (Status: ${res.status || 'Connection Failed'})`,
                    level: 1, 
                    timestamp: Date.now(),
                    url: targetPage.url()
                });
            } else {
                linkStatusCache.set(res.href, { ok: true, timestamp: Date.now() });
            }
        }

        // Step 5: Push links to UI (Restores visibility)
        if (!mainWindow.isClosed()) {
            const allLinksForUI = [
                ...categorizedLinks.internal,
                ...categorizedLinks.external,
                ...categorizedLinks.fragments
            ];

            await mainWindow.evaluate((ls: any[], tId: string) => {
                if (window.updateLinks) {
                    window.updateLinks(ls, tId);
                }
            }, allLinksForUI, tabId);
        }

    } catch (e) {
        const err = e as Error;
        if (!err.message.includes('Target closed') && !err.message.includes('Session closed')) {
            console.error('[Atlas:LinkScanner] Link scan failed:', err.message);
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
