/**
 * Atlas Engine — Network Interceptor
 * 
 * CDP-based request interception, domain masking, chaos injection,
 * response capture, and WebSocket proxying.
 * 
 * Extracted from: src/network/network-manager.ts
 * Uses: security-warden.ts (PII scanning), performance-tracker.ts (anomaly detection)
 * 
 * This is the core proxy engine. It intercepts every request from the
 * browser, rewrites domain-masked URLs to localhost, applies chaos
 * (stress testing), captures response bodies, and runs security scans.
 */

import { Page, HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { Violation, NetworkRequest, ChaosConfig } from './state';
import { scanForPII, maskPII, isInsecureCORS } from './security-warden';
import { PerformanceTracker } from './performance-tracker';

// Re-export for compatibility
export { NetworkRequest };

export interface NetworkInterceptorConfig {
    domain: string;
    localPort: number;
}

export interface NetworkInterceptorCallbacks {
    /** Called when a violation is detected (PII, CORS, performance, stress, HTTP error) */
    onViolation: (violation: Violation) => void;
    /** Called when a network request completes with full data */
    onNetworkEvent: (request: NetworkRequest) => void;
    /** Called for log output to terminal */
    onLog: (message: string) => void;
    /** Called when a navigation occurs */
    onNavigation?: (url: string) => void;
}

export function createNetworkInterceptor(
    page: Page,
    config: NetworkInterceptorConfig,
    callbacks: NetworkInterceptorCallbacks
) {
    const { domain, localPort } = config;

    // --- STATE ---
    let currentSecurityMode: 'Standard' | 'Strict' = 'Standard';
    let stressConfig: ChaosConfig = { enabled: false, errorRate: 0, latencyRate: 0, dropRate: 0 };
    let lastNavPathname: string = '';
    let isCleanedUp = false;

    // Engine modules
    const performanceTracker = new PerformanceTracker();

    // --- EXPOSED FUNCTIONS (Puppeteer bridge) ---
    const exposeControls = async () => {
        try {
            await page.exposeFunction('setSecurityMode', (mode: string) => {
                currentSecurityMode = mode as 'Standard' | 'Strict';
            });
        } catch (e) { /* Already exposed */ }

        try {
            await page.exposeFunction('atlasRecordViolationSrv', (violation: any) => {
                callbacks.onViolation(violation);
            });
        } catch (e) { }

        try {
            await page.exposeFunction('setStressConfig', (config: any) => {
                stressConfig = config;
            });
        } catch (e) { }

        try {
            await page.exposeFunction('getNetworkHistory', () => {
                return requestLogHistory;
            });
        } catch (e) { }

        try {
            await page.exposeFunction('clearNetworkHistory', () => {
                requestLogHistory.length = 0;
            });
        } catch (e) { }

        try {
            await page.exposeFunction('getFullViolationHistory', () => {
                return currentPageViolations;
            });
        } catch (e) { }

        try {
            await page.exposeFunction('clearViolationHistory', () => {
                currentPageViolations.length = 0;
            });
        } catch (e) { }
    };

    // History arrays (kept for backward compat with current Renderer polling)
    const requestLogHistory: any[] = [];
    const currentPageViolations: any[] = [];

    // --- REQUEST HANDLER ---
    const handleRequest = async (request: HTTPRequest, targetPage: Page) => {
        const urlString = request.url();
        const url = new URL(urlString);
        const isMainFrame = request.frame() === targetPage.mainFrame();

        // Clear per-page state on navigation
        let isNewPage = false;
        if (request.isNavigationRequest() && isMainFrame) {
            const normalizePath = (p: string) => p.replace(/\/(index\.html?)?$/, '/');
            const newPathname = normalizePath(url.pathname);

            currentPageViolations.length = 0;
            requestLogHistory.length = 0;

            if (newPathname !== normalizePath(lastNavPathname)) {
                isNewPage = true;
            }
            lastNavPathname = url.pathname;

            if (callbacks.onNavigation) {
                callbacks.onNavigation(urlString);
            }
        }

        // 1. Chaos / Stress Injection
        if (stressConfig.enabled) {
            if (stressConfig.dropRate > 0 && Math.random() * 100 < stressConfig.dropRate) {
                await request.abort('failed');
                return;
            }
            if (stressConfig.errorRate > 0 && Math.random() * 100 < stressConfig.errorRate) {
                const stressViolation: Violation = {
                    source: 'Stress Testing',
                    message: `Stress 500 Error Injection on ${url.pathname}`,
                    level: 2,
                    timestamp: Date.now(),
                    url: urlString
                };
                callbacks.onViolation(stressViolation);

                await request.respond({
                    status: 500,
                    contentType: 'text/html',
                    body: '<h1>500 Internal Server Error (Atlas Stress Injection)</h1><p>This error was intentionally injected by the Atlas Stress Engine.</p>'
                });
                return;
            }
            if (stressConfig.latencyRate > 0 && Math.random() * 100 < stressConfig.latencyRate) {
                const delay = 2000 + Math.random() * 3000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 2. Protocol pass-through
        if (url.protocol === 'about:' || url.protocol === 'chrome:' || url.protocol === 'data:' || url.protocol === 'file:') {
            await request.continue();
            return;
        }

        // 3. Domain proxy (if hostname matches masked domain → proxy to localhost)
        if (url.hostname === domain) {
            // WebSocket bypass
            if (request.resourceType() === 'websocket' || request.headers()['upgrade'] === 'websocket') {
                const targetPath = url.pathname;
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

            try {
                const startTime = Date.now();
                const headers: Record<string, string> = { ...request.headers(), 'x-forwarded-proto': 'https' };

                const response = await fetch(localUrl, {
                    method: request.method(),
                    headers: headers as any,
                    body: request.postData()
                });

                const buffer = await response.arrayBuffer();
                const duration = Date.now() - startTime;

                // Performance check
                const perfViolation = performanceTracker.check(url.pathname, duration, targetPage.url());
                if (perfViolation) {
                    callbacks.onViolation(perfViolation);
                }

                const resHeaders: any = Object.fromEntries(response.headers.entries());

                if (typeof (response.headers as any).getSetCookie === 'function') {
                    const cookies = (response.headers as any).getSetCookie();
                    if (cookies && cookies.length > 0) {
                        resHeaders['set-cookie'] = cookies;
                    }
                }

                // Remove headers that conflict with proxy
                delete resHeaders['x-frame-options'];
                delete resHeaders['content-security-policy'];
                delete resHeaders['content-length'];
                delete resHeaders['content-encoding'];
                delete resHeaders['transfer-encoding'];

                // Build network event
                const networkEvent: NetworkRequest = {
                    id: Math.random().toString(36).substring(7),
                    url: url.href,
                    method: request.method(),
                    status: response.status,
                    type: headers['x-atlas-audit'] ? 'Audit' : request.resourceType(),
                    time: duration,
                    reqHeaders: JSON.parse(JSON.stringify(request.headers())),
                    resHeaders: JSON.parse(JSON.stringify(resHeaders)),
                    body: '',
                    _page: lastNavPathname || '/'
                };

                // HTTP error violations (4xx, 5xx)
                if (response.status >= 400) {
                    const level = response.status >= 500 ? 2 : 1;
                    callbacks.onViolation({
                        source: 'Network',
                        message: `HTTP ${response.status} on ${url.pathname}`,
                        level,
                        timestamp: Date.now(),
                        url: urlString
                    });
                }

                // Capture body for text responses
                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('json') || contentType.includes('text') || contentType.includes('xml')) {
                        const str = Buffer.from(buffer).toString('utf-8');

                        if (str.length > 1000000) {
                            // Skip PII scan on very large files (>1MB)
                            networkEvent.body = str.substring(0, 5000) + '... (Truncated Very Large File)';
                        } else {
                            networkEvent.body = str.length > 100000 ? str.substring(0, 100000) + '... (Truncated)' : str;

                            // PII Detection
                            const isSamePageNav = request.isNavigationRequest() && isMainFrame && !isNewPage;
                            const isHtmlPage = contentType.includes('html');
                            const leaks = isSamePageNav ? [] : scanForPII(str, isHtmlPage);

                            if (leaks.length > 0) {
                                callbacks.onLog(`[Atlas Security] 🎯 Found ${leaks.length} PII leaks in ${url.pathname} (${contentType})`);

                                leaks.forEach(leak => {
                                    // Audit fix: mask PII in violation messages
                                    const maskedMatches = leak.matches.map(m => maskPII(m));
                                    callbacks.onViolation({
                                        source: 'Security Warden',
                                        message: `PII Leak(${leak.type}) detected in ${url.pathname}: ${maskedMatches.join(', ')}`,
                                        level: 2,
                                        timestamp: Date.now(),
                                        url: urlString
                                    });
                                });
                            }
                        }
                    } else {
                        networkEvent.body = `[Binary Data: ${contentType}]`;
                    }
                } catch (e) {
                    networkEvent.body = '[Error capturing body]';
                }

                // Emit network event
                requestLogHistory.push(networkEvent);
                if (requestLogHistory.length > 500) requestLogHistory.shift();
                callbacks.onNetworkEvent(networkEvent);

                // Push to browser UI (backward compat during migration)
                if (!page.isClosed()) {
                    page.evaluate((d) => {
                        try {
                            // @ts-ignore
                            if (window.Atlas && window.Atlas.logNetworkRequest) window.Atlas.logNetworkRequest(d);
                            // @ts-ignore
                            else { window.__ATLAS_NETWORK_QUEUE__ = window.__ATLAS_NETWORK_QUEUE__ || []; window.__ATLAS_NETWORK_QUEUE__.push(d); }
                        } catch (e) { }
                    }, networkEvent as any).catch(() => { });
                }

                // CORS strictness check
                if (currentSecurityMode === 'Strict') {
                    const acao = resHeaders['access-control-allow-origin'];
                    if (isInsecureCORS(acao)) {
                        delete resHeaders['access-control-allow-origin'];
                        callbacks.onViolation({
                            source: 'Security Warden',
                            message: `Blocked insecure CORS wildcard(*) on ${url.pathname}`,
                            level: 2,
                            timestamp: Date.now(),
                            url: urlString
                        });
                    }
                }

                await request.respond({
                    status: response.status,
                    contentType: response.headers.get('content-type') || undefined,
                    headers: resHeaders,
                    body: Buffer.from(buffer)
                });

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
                await request.respond({ status: 502, contentType: 'text/html', body: errorHtml });
            }
            return;
        }

        // 4. Block external navigation on main frame
        if (isMainFrame && request.isNavigationRequest() && url.hostname !== domain && !url.hostname.includes('localhost')) {
            await request.abort('blockedbyclient');
            return;
        }

        // 5. Allow other resources (CDNs, images, media, fonts)
        if (request.resourceType() === 'image' || request.resourceType() === 'media' || request.resourceType() === 'font') {
            await request.continue();
            return;
        }

        await request.continue();
    };

    // --- ATTACH ---
    const attach = async (p: Page) => {
        await p.setRequestInterception(true);
        p.on('request', (req) => handleRequest(req, p));

        // Global failure tracker for Scalability tab
        p.on('requestfailed', (req) => {
            const url = req.url();
            const errorText = req.failure()?.errorText || 'Failed';

            // Only report if it's not a blocked navigation (which we handle)
            if (errorText !== 'net::ERR_ABORTED' && errorText !== 'blockedbyclient') {
                callbacks.onViolation({
                    source: 'Network',
                    message: `Resource Failed: ${url.split('/').pop()} (${errorText})`,
                    level: 1,
                    timestamp: Date.now(),
                    url: url
                });
            }
        });
    };

    // --- WEBSOCKET PROXY ---
    let wsProxyServer: any;
    let wsProxyPort = 0;

    const initWsProxy = async () => {
        const { WebSocketServer, WebSocket } = await import('ws');

        return new Promise<void>((resolve) => {
            wsProxyServer = new WebSocketServer({ port: 0 });

            wsProxyServer.on('listening', () => {
                wsProxyPort = (wsProxyServer.address() as any).port;
                resolve();
            });

            wsProxyServer.on('connection', (clientWs: any, req: any) => {
                const reqUrl = new URL(req.url, 'http://localhost');
                const targetUrlEncoded = reqUrl.searchParams.get('__target');

                if (!targetUrlEncoded) { clientWs.close(); return; }

                const targetUrl = decodeURIComponent(targetUrlEncoded);

                // Audit fix: SSRF protection — only allow localhost targets
                try {
                    const parsedTarget = new URL(targetUrl);
                    if (parsedTarget.hostname !== 'localhost' && parsedTarget.hostname !== '127.0.0.1') {
                        clientWs.close();
                        return;
                    }
                } catch (e) {
                    clientWs.close();
                    return;
                }

                if (currentSecurityMode === 'Offline' as any) { clientWs.close(); return; }

                const targetWs = new WebSocket(targetUrl);

                targetWs.on('error', () => clientWs.close());
                clientWs.on('error', () => targetWs.close());
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
                        setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(data, { binary: isBinary }); }, latency);
                    } else {
                        if (ws.readyState === WebSocket.OPEN) ws.send(data, { binary: isBinary });
                    }
                };

                targetWs.on('message', (data: any, isBinary: boolean) => sendMessage(clientWs, data, isBinary));
                clientWs.on('message', (data: any, isBinary: boolean) => sendMessage(targetWs, data, isBinary));
            });
        });
    };

    // --- PUBLIC API ---
    const init = async () => {
        await initWsProxy();
        await exposeControls();
        await attach(page);
    };

    const cleanup = async () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        if (wsProxyServer) {
            try { wsProxyServer.close(); } catch (e) { }
        }
    };

    const setSecurityMode = (mode: 'Standard' | 'Strict') => { currentSecurityMode = mode; };
    const setStressConfig = (config: ChaosConfig) => { stressConfig = config; };
    const getRequestHistory = () => requestLogHistory;
    const getViolations = () => currentPageViolations;

    return {
        init,
        attach,
        cleanup,
        setSecurityMode,
        setStressConfig,
        getRequestHistory,
        getViolations
    };
}
