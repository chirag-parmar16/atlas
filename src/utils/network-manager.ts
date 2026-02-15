import { Page, HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { ReportManager } from './report-manager';

export interface NetworkConfig {
    domain: string;
    localPort: number;
}

export function createNetworkManager(page: Page, config: NetworkConfig, reportManager?: ReportManager, logger: (msg: string) => void = console.log) {
    const { domain, localPort } = config;

    // --- STATE ---
    let currentSecurityMode = 'Standard';
    let stressConfig = { enabled: false, errorRate: 0, latencyRate: 0, dropRate: 0 };

    // History Array to store requests across navigations
    const requestLogHistory: any[] = [];
    const violationHistory: any[] = [];       // Permanent — for JSON report
    const currentPageViolations: any[] = [];  // Cleared on navigation — for browser sync
    let lastNavPathname: string = '';          // Track pathname for hash-change detection

    // --- PII SCANNER ---
    const scanForPII = (text: string, isHtmlPage: boolean = false): { type: string, matches: string[] }[] => {
        const results: { type: string, matches: string[] }[] = [];
        const patterns: Record<string, RegExp> = {
            CreditCard: /\b(?:\d[ -]*?){13,16}\b/g,
            AuthToken: /\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16})\b/gi
        };

        // Only scan for emails on non-HTML responses (API data).
        // HTML pages commonly display contact emails — those are intentional, not leaks.
        if (!isHtmlPage) {
            patterns.Email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        }

        // Strip URLs and HTML attributes to prevent false positives from number sequences
        // in URLs (e.g., Unsplash photo IDs like "photo-1581578731548-c64695cc6952")
        let cleanText = text
            .replace(/https?:\/\/[^\s"'<>]+/g, '')      // Remove full URLs
            .replace(/(?:src|href|action|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, ''); // Remove HTML attributes with URLs

        for (const [type, regex] of Object.entries(patterns)) {
            const matches = cleanText.match(regex);
            if (matches) {
                // For CC, do a tiny bit more filtering to avoid small decimals/dates
                const filtered = type === 'CreditCard'
                    ? matches.filter(m => m.replace(/[ -]/g, '').length >= 13)
                    : matches;

                if (filtered.length > 0) results.push({ type, matches: filtered });
            }
        }
        return results;
    };

    // --- PERFORMANCE MONITOR ---
    const latencyStore: Record<string, number[]> = {};
    const checkPerformance = (urlPath: string, duration: number) => {
        // Only track successful (likely stable) Fetch/XHR requests
        if (!latencyStore[urlPath]) latencyStore[urlPath] = [];

        const history = latencyStore[urlPath];
        if (history.length >= 3) {
            const avg = history.reduce((a, b) => a + b, 0) / history.length;
            if (duration > avg * 2 && duration > 250) {
                const message = `Slowness detected on ${urlPath}: ${duration}ms (Avg: ${Math.round(avg)}ms)`;
                const perfViolation = { source: 'Performance', message, level: 1, timestamp: Date.now(), url: page.url() };
                violationHistory.push(perfViolation);
                currentPageViolations.push(perfViolation);
                if (reportManager) reportManager.logViolation(perfViolation).catch(() => { });
                page.evaluate((uPath, dur, a) => {
                    const atlas = (window as any).Atlas;
                    if (atlas) {
                        atlas.reportViolation('Performance', `Slowness detected on ${uPath}: ${dur}ms (Avg: ${Math.round(a)}ms)`, 1);
                    }
                }, urlPath, duration, avg).catch(() => { });
            }
        }

        history.push(duration);
        if (history.length > 5) history.shift(); // Keep last 5
    };

    // --- EXPOSED FUNCTIONS ---
    const exposeControls = async () => {

        await page.exposeFunction('setSecurityMode', (mode: string) => {
            currentSecurityMode = mode;
        });

        await page.exposeFunction('atlasRecordViolationSrv', (violation: any) => {
            violationHistory.push(violation);
            currentPageViolations.push(violation);
        });

        await page.exposeFunction('setStressConfig', (config: any) => {
            stressConfig = config;
        });

        await page.exposeFunction('getNetworkHistory', () => {
            return requestLogHistory;
        });

        await page.exposeFunction('clearNetworkHistory', () => {
            requestLogHistory.length = 0;
        });

        await page.exposeFunction('getFullViolationHistory', () => {
            return currentPageViolations;
        });

        await page.exposeFunction('clearViolationHistory', () => {
            currentPageViolations.length = 0;
        });
    };

    // --- THE IMMORTAL PILL PROXY ---
    const handleRequest = async (request: HTTPRequest, targetPage: Page) => {
        const urlString = request.url();
        const url = new URL(urlString);
        const isMainFrame = request.frame() === targetPage.mainFrame();

        // Clear current page violations only when pathname actually changes (not hash-only navigation)
        let isNewPage = false;
        if (request.isNavigationRequest() && isMainFrame) {
            // Normalize: treat /, /index.html, /index.htm as the same page
            const normalizePath = (p: string) => p.replace(/\/(index\.html?)?$/, '/');
            const newPathname = normalizePath(url.pathname);
            if (newPathname !== normalizePath(lastNavPathname)) {
                currentPageViolations.length = 0;
                isNewPage = true;
            }
            lastNavPathname = url.pathname;
            // Log navigation BEFORE proxy fetch — ensures it appears before any violations
            // from the response (PII scan etc). reportManager.logNavigation deduplicates,
            // so the later call from browser.ts framenavigated will be safely skipped.
            if (reportManager) {
                reportManager.logNavigation(urlString);
            }
        }

        // 1. Throttling & Chaos Check
        // 1. Throttling & Chaos Check

        if (stressConfig.enabled) {
            if (stressConfig.dropRate > 0 && Math.random() * 100 < stressConfig.dropRate) {
                await request.abort('failed');
                return;
            }
            if (stressConfig.errorRate > 0 && Math.random() * 100 < stressConfig.errorRate) {
                const failMsg = '[Atlas Stress] 🎲 Request randomly failed (500) due to Stress Rate setting.';
                await page.evaluate((m) => console.warn(m), failMsg).catch(() => { });

                // [HEALTH] Report Stress 500
                const stressViolation = { source: 'Stress Testing', message: `Stress 500 Error Injection on ${url.pathname}`, level: 2, timestamp: Date.now(), url: urlString };
                violationHistory.push(stressViolation);
                currentPageViolations.push(stressViolation);
                if (reportManager) reportManager.logViolation(stressViolation).catch(() => { });
                await page.evaluate((u) => {
                    try { (window as any).Atlas.reportViolation('Stress Testing', `Stress 500 Error Injection on ${u}`, 2); } catch (e) { }
                }, url.pathname).catch(() => { });

                await request.respond({ status: 500, contentType: 'text/html', body: '<h1>500 Internal Server Error (Atlas Stress Injection)</h1><p>This error was intentionally injected by the Atlas Stress Engine.</p>' });
                return;
            }
            if (stressConfig.latencyRate > 0 && Math.random() * 100 < stressConfig.latencyRate) {
                const delay = 2000 + Math.random() * 3000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        let latency = 0;

        // 2. Protocols to Ignore (Pass-through)
        if (url.protocol === 'about:' || url.protocol === 'chrome:' || url.protocol === 'data:' || url.protocol === 'file:') {
            await request.continue();
            return;
        }

        // 3. TARGET PROXY (If hostname matches domain, proxy to localhost)
        if (url.hostname === domain) {
            // WebSocket / HMR Bypass
            if (request.resourceType() === 'websocket' || request.headers()['upgrade'] === 'websocket') {
                const targetPath = url.pathname;

                // If we have a proxy running, use it
                if (wsProxyPort > 0) {
                    const originalTarget = `ws://localhost:${localPort}${targetPath}${url.search}`;
                    const proxyUrl = `ws://localhost:${wsProxyPort}${targetPath}?__target=${encodeURIComponent(originalTarget)}`;
                    await request.continue({ url: proxyUrl });
                } else {
                    const localUrl = `ws://localhost:${localPort}${targetPath}${url.search}`;
                    await request.continue({ url: localUrl });
                }
                return;
            }

            const targetPath = url.pathname;
            const localUrl = `http://localhost:${localPort}${targetPath}${url.search}`;

            // [UI] Start Loading Bar
            if (request.isNavigationRequest() || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                if (!page.isClosed()) page.evaluate(() => { try { (window as any).Atlas.startLoading(); } catch (e) { } }).catch(() => { });
            }

            try {
                const startTime = Date.now();
                const headers = { ...request.headers(), 'x-forwarded-proto': 'https' };

                const response = await fetch(localUrl, {
                    method: request.method(),
                    headers: headers as any,
                    body: request.postData()
                });

                const buffer = await response.arrayBuffer();
                const duration = Date.now() - startTime;

                checkPerformance(url.pathname, duration);

                const resHeaders: any = Object.fromEntries(response.headers.entries());

                if (typeof (response.headers as any).getSetCookie === 'function') {
                    const cookies = (response.headers as any).getSetCookie();
                    if (cookies && cookies.length > 0) {
                        resHeaders['set-cookie'] = cookies;
                    }
                }

                delete resHeaders['x-frame-options'];
                delete resHeaders['content-security-policy'];
                delete resHeaders['content-length'];
                delete resHeaders['content-encoding'];
                delete resHeaders['transfer-encoding'];

                // --- LOG TO ATLAS UI ---
                const safeLogData = {
                    id: Math.random().toString(36).substring(7),
                    url: url.href.replace(localUrl, urlString),
                    method: request.method(),
                    status: response.status,
                    type: 'Fetch',
                    time: duration,
                    reqHeaders: JSON.parse(JSON.stringify(request.headers())),
                    resHeaders: JSON.parse(JSON.stringify(resHeaders)),
                    body: ''
                };

                // [HEALTH] Report HTTP Errors (4xx, 5xx)
                if (response.status >= 400 && !page.isClosed()) {
                    const level = response.status >= 500 ? 2 : 1;
                    const netViolation = { source: 'Network', message: `HTTP ${response.status} on ${url.pathname}`, level, timestamp: Date.now(), url: urlString };
                    violationHistory.push(netViolation);
                    currentPageViolations.push(netViolation);
                    if (reportManager) reportManager.logViolation(netViolation).catch(() => { });
                    // No page.evaluate — sync engine will pick up from currentPageViolations
                }

                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('json') || contentType.includes('text') || contentType.includes('xml')) {
                        const str = Buffer.from(buffer).toString('utf-8');

                        // Performance Optimization: Skip PII scan for extremely large files (>200KB)
                        if (str.length > 200000) {
                            safeLogData.body = str.substring(0, 1000) + '... (Truncated Large File)';
                            // Skip leaks check
                        } else {
                            safeLogData.body = str.length > 100000 ? str.substring(0, 100000) + '... (Truncated)' : str;

                            // --- PII DETECTION ---
                            // Skip emails on HTML pages (visible contact info is not a leak).
                            // Always detect Credit Cards & Auth Tokens — they should NEVER appear in page source.
                            const isSamePageNav = request.isNavigationRequest() && isMainFrame && !isNewPage;
                            const isHtmlPage = contentType.includes('html');
                            const leaks = isSamePageNav ? [] : scanForPII(str, isHtmlPage);

                            // Only log when actual leaks are found
                            if (leaks.length > 0) {
                                const contentType = response.headers.get('content-type') || 'unknown';
                                logger(`[Atlas Security] 🎯 Found ${leaks.length} PII leaks in ${url.pathname} (${contentType})`);
                            }

                            // Store violations in server-side history IMMEDIATELY
                            if (leaks.length > 0) {
                                leaks.forEach(leak => {
                                    const secViolation = {
                                        source: 'Security Warden',
                                        message: `PII Leak(${leak.type}) detected in ${url.pathname}: ${leak.matches.join(', ')}`,
                                        level: 2,
                                        timestamp: Date.now(),
                                        url: urlString
                                    };
                                    violationHistory.push(secViolation);
                                    currentPageViolations.push(secViolation);
                                    if (reportManager) reportManager.logViolation(secViolation).catch(() => { });
                                });
                            }
                            // No page.evaluate — sync engine will pick up from currentPageViolations
                        }
                    } else {
                        safeLogData.body = `[Binary Data: ${contentType}]`;
                    }
                } catch (e) {
                    safeLogData.body = '[Error capturing body]';
                }

                requestLogHistory.push(safeLogData);
                if (requestLogHistory.length > 500) requestLogHistory.shift();

                if (!page.isClosed()) {
                    page.evaluate((d) => {
                        try {
                            // @ts-ignore
                            if (window.Atlas && window.Atlas.logNetworkRequest) window.Atlas.logNetworkRequest(d);
                            // @ts-ignore
                            else { window.__ATLAS_NETWORK_QUEUE__ = window.__ATLAS_NETWORK_QUEUE__ || []; window.__ATLAS_NETWORK_QUEUE__.push(d); }
                        } catch (e) { }
                    }, safeLogData).catch(() => { });
                }

                // Security Audits
                if (currentSecurityMode === 'Strict') {
                    const acao = resHeaders['access-control-allow-origin'];
                    if (acao && (acao === '*' || acao === 'null')) {
                        delete resHeaders['access-control-allow-origin'];
                        if (!page.isClosed()) {
                            page.evaluate((u) => {
                                try {
                                    // @ts-ignore
                                    if (window.Atlas) window.Atlas.reportViolation('Security Warden', `Blocked insecure CORS wildcard(*) on ${u}`, 2);
                                } catch (e) { }
                            }, url.pathname).catch(() => { });
                        }
                    }
                }

                await request.respond({
                    status: response.status,
                    contentType: response.headers.get('content-type') || undefined,
                    headers: resHeaders,
                    body: Buffer.from(buffer)
                });

                // [UI] Stop Loading Bar
                if (request.isNavigationRequest() || request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                    if (!page.isClosed()) page.evaluate(() => { try { (window as any).Atlas.stopLoading(); } catch (e) { } }).catch(() => { });
                }

            } catch (error) {
                const errorMsg = (error as any).message || 'Unknown Error';
                const errorHtml = `
                    <html>
                    <head>
                        <title>Atlas Proxy Error</title>
                        <style>
                            body { background: #111; color: #eee; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                            .container { text-align: center; max-width: 500px; padding: 20px; border: 1px solid #333; border-radius: 8px; background: #1a1a1a; }
                            h1 { color: #ef4444; margin-bottom: 10px; }
                            p { color: #aaa; margin-bottom: 20px; }
                            .code { font-family: monospace; background: #000; padding: 10px; border-radius: 4px; color: #facc15; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Connection Failed</h1>
                            <p>Atlas could not connect to your local server.</p>
                            <div class="code">Target: http://localhost:${localPort}<br>Error: ${errorMsg}</div>
                            <p style="margin-top:20px; font-size: 12px;">Use the Atlas Tool (bottom right) to reload once your server is ready.</p>
                        </div>
                    </body>
                    </html>
                `;

                await request.respond({
                    status: 502,
                    contentType: 'text/html',
                    body: errorHtml
                });
            }
            return;
        }

        // 4. Block Other External Navigation on Main Frame
        if (isMainFrame && request.isNavigationRequest() && url.hostname !== domain && !url.hostname.includes('localhost')) {
            await request.abort('blockedbyclient');
            return;
        }

        // 5. Allow other resources (CDNs, Images, Media, Scripts)
        // Explicitly ensure images/media are never blocked even if they look weird
        if (request.resourceType() === 'image' || request.resourceType() === 'media' || request.resourceType() === 'font') {
            await request.continue();
            return;
        }

        // 5. Allow other resources (e.g. CDNs)
        await request.continue();
    };

    // Generic Attach Logic
    const attach = async (p: Page) => {
        await p.setRequestInterception(true);
        p.on('request', (req) => handleRequest(req, p));
    };

    // --- WEBSOCKET PROXY ---
    let wsProxyServer: any;
    let wsProxyPort = 0;

    const initWsProxy = async () => {
        const { WebSocketServer, WebSocket } = await import('ws');

        return new Promise<void>((resolve) => {
            wsProxyServer = new WebSocketServer({ port: 0 }); // Random port

            wsProxyServer.on('listening', () => {
                wsProxyPort = (wsProxyServer.address() as any).port;
                resolve();
            });

            wsProxyServer.on('connection', (clientWs: any, req: any) => {
                const reqUrl = new URL(req.url, 'http://localhost');
                const targetUrlEncoded = reqUrl.searchParams.get('__target');

                if (!targetUrlEncoded) {
                    clientWs.close();
                    return;
                }

                const targetUrl = decodeURIComponent(targetUrlEncoded);

                if (currentSecurityMode === 'Offline') {
                    clientWs.close();
                    return;
                }

                const targetWs = new WebSocket(targetUrl);

                targetWs.on('error', (e: any) => {
                    clientWs.close();
                });

                clientWs.on('error', (e: any) => {
                    targetWs.close();
                });

                targetWs.on('close', () => clientWs.close());
                clientWs.on('close', () => targetWs.close());

                const sendMessage = (ws: any, data: any, isBinary: boolean) => {
                    let latency = 0;

                    if (stressConfig.enabled) {
                        if (stressConfig.dropRate > 0 && Math.random() * 100 < stressConfig.dropRate) return;
                        if (stressConfig.latencyRate > 0 && Math.random() * 100 < stressConfig.latencyRate) {
                            latency += (2000 + Math.random() * 3000);
                        }
                    }

                    if (latency > 0) {
                        setTimeout(() => {
                            if (ws.readyState === WebSocket.OPEN) ws.send(data, { binary: isBinary });
                        }, latency);
                    } else {
                        if (ws.readyState === WebSocket.OPEN) ws.send(data, { binary: isBinary });
                    }
                };

                targetWs.on('message', (data: any, isBinary: boolean) => sendMessage(clientWs, data, isBinary));
                clientWs.on('message', (data: any, isBinary: boolean) => sendMessage(targetWs, data, isBinary));
            });
        });
    };

    // Initialize
    const init = async () => {
        await initWsProxy();

        await exposeControls();
        await attach(page);
    };

    return { init, attach };
}