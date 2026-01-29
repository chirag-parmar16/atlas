import { Page, HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';

export interface NetworkConfig {
    domain: string;
    localPort: number;
}

export function createNetworkManager(page: Page, config: NetworkConfig) {
    const { domain, localPort } = config;

    // --- STATE ---
    let currentThrottlingProfile = 'No Throttling';
    let currentSecurityMode = 'Standard';
    let chaosConfig = { enabled: false, errorRate: 0, latencyRate: 0, dropRate: 0 };

    // [FIX] History Array to store requests across navigations
    const requestLogHistory: any[] = [];

    // --- PII SCANNER ---
    const scanForPII = (text: string): { type: string, matches: string[] }[] => {
        const results: { type: string, matches: string[] }[] = [];
        const patterns = {
            Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            CreditCard: /\b(?:\d[ -]*?){13,16}\b/g,
            AuthToken: /\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16})\b/gi
        };

        for (const [type, regex] of Object.entries(patterns)) {
            const matches = text.match(regex);
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
            // If current duration > 2x average AND > 250ms (ignore tiny blips)
            if (duration > avg * 2 && duration > 250) {
                page.evaluate((path, dur, a) => {
                    const atlas = (window as any).Atlas;
                    if (atlas) {
                        atlas.reportViolation('Performance', `Slowness detected on ${path}: ${dur}ms (Avg: ${Math.round(a)}ms)`, 1);
                    }
                }, urlPath, duration, avg).catch(() => { });
            }
        }

        history.push(duration);
        if (history.length > 5) history.shift(); // Keep last 5
    };

    // --- EXPOSED FUNCTIONS ---
    const exposeControls = async () => {
        await page.exposeFunction('setThrottling', (profile: string) => {
            // console.log(`[Proxy] Throttling set to: ${profile}`);
            currentThrottlingProfile = profile;

            // Sync HUD
            page.evaluate((prof) => {
                const tag = document.querySelector('#atlas-tools-host')?.shadowRoot?.querySelector('#hud-throttle');
                if (tag) tag.textContent = prof;
            }, profile).catch(() => { });
        });

        await page.exposeFunction('setSecurityMode', (mode: string) => {
            // console.log(`[Proxy] Security Mode set to: ${mode}`);
            currentSecurityMode = mode;
        });

        await page.exposeFunction('setChaosConfig', (config: any) => {
            // console.log(`[Proxy] Chaos Config updated:`, config);
            chaosConfig = config;
        });

        // [FIX] Expose History Getter so new pages can retrieve old logs
        await page.exposeFunction('getNetworkHistory', () => {
            return requestLogHistory;
        });

        await page.exposeFunction('clearNetworkHistory', () => {
            requestLogHistory.length = 0;
            // console.log('[Proxy] Network history cleared');
        });
    };

    // --- THE IMMORTAL PILL PROXY ---
    const handleRequest = async (request: HTTPRequest, targetPage: Page) => {
        const urlString = request.url();
        const url = new URL(urlString);
        const isMainFrame = request.frame() === targetPage.mainFrame();

        // 1. Throttling & Chaos Check
        if (currentThrottlingProfile === 'Offline') {
            await request.abort('failed');
            return;
        }

        if (chaosConfig.enabled) {
            if (chaosConfig.dropRate > 0 && Math.random() * 100 < chaosConfig.dropRate) {
                await request.abort('failed');
                return;
            }
            if (chaosConfig.errorRate > 0 && Math.random() * 100 < chaosConfig.errorRate) {
                await request.respond({ status: 500, contentType: 'text/html', body: '<h1>500 Internal Server Error (Atlas Chaos Injection)</h1>' });
                return;
            }
            if (chaosConfig.latencyRate > 0 && Math.random() * 100 < chaosConfig.latencyRate) {
                const delay = 2000 + Math.random() * 3000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        let latency = 0;
        if (currentThrottlingProfile === 'Slow 4G') latency = 100;
        else if (currentThrottlingProfile === 'Fast 4G') latency = 20;

        if (latency > 0) {
            await new Promise(r => setTimeout(r, latency));
        }

        // 2. Protocols to Ignore (Pass-through)
        if (url.protocol === 'about:' || url.protocol === 'chrome:' || url.protocol === 'data:' || url.protocol === 'file:') {
            await request.continue();
            return;
        }

        // 3. TARGET PROXY (If hostname matches domain, proxy to localhost)
        if (url.hostname === domain) {
            // [FIX] WebSocket / HMR Bypass
            // Fetch cannot handle WebSockets, so we must redirect these directly to localhost
            // [FIX] WebSocket / HMR Bypass
            // Fetch cannot handle WebSockets, so we must redirect these directly to localhost
            if (request.resourceType() === 'websocket' || request.headers()['upgrade'] === 'websocket') {
                const targetPath = url.pathname;

                // If we have a proxy running, use it
                if (wsProxyPort > 0) {
                    const originalTarget = `ws://localhost:${localPort}${targetPath}${url.search}`;
                    const proxyUrl = `ws://localhost:${wsProxyPort}${targetPath}?__target=${encodeURIComponent(originalTarget)}`;
                    // console.log(`[Proxy] Intercepting WebSocket: ${url.href} -> ${proxyUrl}`);
                    await request.continue({ url: proxyUrl });
                } else {
                    // Fallback (Shouldn't happen if init waits)
                    const localUrl = `ws://localhost:${localPort}${targetPath}${url.search}`;
                    await request.continue({ url: localUrl });
                }
                return;
            }

            const targetPath = url.pathname;
            const localUrl = `http://localhost:${localPort}${targetPath}${url.search}`;

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

                // [FIX] Preserve multiple Set-Cookie headers
                // Node 18+ fetch (Undici) merges duplicate headers in .entries(), but supports getSetCookie()
                if (typeof (response.headers as any).getSetCookie === 'function') {
                    const cookies = (response.headers as any).getSetCookie();
                    if (cookies && cookies.length > 0) {
                        resHeaders['set-cookie'] = cookies;
                    }
                }

                delete resHeaders['x-frame-options'];
                delete resHeaders['content-security-policy'];
                // Fix: Remove content-length/encoding mismatch (Node fetch decompresses, but header might be compressed size)
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

                try {
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('json') || contentType.includes('text') || contentType.includes('xml')) {
                        const str = Buffer.from(buffer).toString('utf-8');
                        safeLogData.body = str.length > 8000 ? str.substring(0, 8000) + '... (Truncated)' : str;

                        // --- PII DETECTION ---
                        const leaks = scanForPII(str);
                        if (leaks.length > 0 && !page.isClosed()) {
                            leaks.forEach(leak => {
                                page.evaluate((lType, lMatches, pUrl) => {
                                    // @ts-ignore
                                    const atlas = (window as any).Atlas;
                                    if (atlas) {
                                        atlas.reportViolation('Security Warden', `PII Leak (${lType}) detected in ${pUrl}: ${lMatches.join(', ')}`, 2);
                                    }
                                }, leak.type, leak.matches, url.pathname).catch(() => { });
                            });
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
                                    if (window.Atlas) window.Atlas.reportViolation('Security Warden', `Blocked insecure CORS wildcard (*) on ${u}`, 2);
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

            } catch (error) {
                // [FIXED BLOCK] Instead of aborting (which hides UI), respond with a custom Error Page.
                // This keeps the DOM alive so the Immortal Pill can render.

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
        if (isMainFrame && url.hostname !== domain && !url.hostname.includes('localhost')) {
            // console.log(`[Atlas] Blocking external navigation to: ${url.hostname}`);
            await request.abort('blockedbyclient');
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
    // We need a separate WebSocket server because Puppeteer's request interception doesn't fully support message-level control for WS.
    // This proxy server intercepts WebSocket connections, forwards them to the real target, and injects chaos/throttling on messages.
    // Architecture:
    //   Browser WS Client -> Proxy Server (this) -> Real Local Server
    // All messages pass through this proxy, allowing us to:
    //   1. Apply network throttling (Slow 4G, Fast 4G)
    //   2. Inject chaos (packet drops, latency spikes)
    //   3. Simulate offline mode (close connections)
    let wsProxyServer: any;
    let wsProxyPort = 0;

    const initWsProxy = async () => {
        const { WebSocketServer, WebSocket } = await import('ws');

        return new Promise<void>((resolve) => {
            wsProxyServer = new WebSocketServer({ port: 0 }); // Random port

            wsProxyServer.on('listening', () => {
                wsProxyPort = (wsProxyServer.address() as any).port;
                // console.log(`[Proxy] WS Interceptor running on port ${wsProxyPort}`);
                resolve();
            });

            wsProxyServer.on('connection', (clientWs: any, req: any) => {
                // Parse original target from URL (passed by our interceptor)
                // Format: ws://localhost:PROXY_PORT/path?__target=ENCODED_TARGET_URL
                const reqUrl = new URL(req.url, 'http://localhost');
                const targetUrlEncoded = reqUrl.searchParams.get('__target');

                if (!targetUrlEncoded) {
                    clientWs.close();
                    return;
                }

                const targetUrl = decodeURIComponent(targetUrlEncoded);

                // --- OFFLINE CHECK (On Connect) ---
                if (currentThrottlingProfile === 'Offline' || currentSecurityMode === 'Offline') {
                    clientWs.close(); // Simulate connection failure
                    return;
                }

                // Connect to real target
                const targetWs = new WebSocket(targetUrl);

                // Open
                targetWs.on('open', () => {
                    // Send buffered messages if any? (Usually none at this point)
                });

                // Error
                targetWs.on('error', (e: any) => {
                    // console.error('[Proxy] WS Target Error:', e.message);
                    clientWs.close();
                });

                clientWs.on('error', (e: any) => {
                    // console.error('[Proxy] WS Client Error:', e.message);
                    targetWs.close();
                });

                // Close
                targetWs.on('close', () => clientWs.close());
                clientWs.on('close', () => targetWs.close());

                // --- MESSAGE HANDLING (With Latency) ---
                const sendMessage = (ws: any, data: any, isBinary: boolean) => {
                    let latency = 0;
                    if (currentThrottlingProfile === 'Slow 4G') latency = 100;
                    else if (currentThrottlingProfile === 'Fast 4G') latency = 20;

                    // Chaos
                    if (chaosConfig.enabled) {
                        if (chaosConfig.dropRate > 0 && Math.random() * 100 < chaosConfig.dropRate) return; // Drop frame
                        if (chaosConfig.latencyRate > 0 && Math.random() * 100 < chaosConfig.latencyRate) {
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
        // Init WS Proxy
        await initWsProxy();

        // --- TRAFFIC SIMULATION ---
        await page.exposeFunction('startTrafficSim', async (targetUrl: string, count: number) => {
            const http = await import('http');

            // console.log(`[Node] Starting traffic sim: ${count} users -> ${targetUrl}`);
            const agent = new http.Agent({ keepAlive: true, maxSockets: 1000 });

            // Rewrite URL to local server
            const urlObj = new URL(targetUrl);
            const realUrl = `http://localhost:${localPort}${urlObj.pathname}${urlObj.search}`;

            let success = 0;
            let fail = 0;
            let completed = 0;

            const updateBrowserContext = async () => {
                try {
                    if (page.isClosed()) {
                        return;
                    }
                    await page.evaluate((s, f, c, t) => {
                        window.dispatchEvent(new CustomEvent('atlas-traffic-update', {
                            detail: { s, f, c, total: t }
                        }));
                    }, success, fail, completed, count);
                } catch (e) { }
            };

            const hitSite = () => {
                return new Promise<void>((resolve) => {
                    const req = http.get(realUrl, { agent }, (res) => {
                        res.on('data', () => { }); // Consume
                        res.on('end', () => {
                            if (res.statusCode && res.statusCode < 400) success++; else fail++;
                            completed++;
                            updateBrowserContext();
                            resolve();
                        });
                    });
                    req.on('error', () => {
                        fail++; completed++; updateBrowserContext(); resolve();
                    });
                    req.setTimeout(5000, () => {
                        req.destroy();
                        fail++; completed++; updateBrowserContext(); resolve();
                    });
                });
            };

            const tasks = [];
            for (let i = 0; i < count; i++) {
                tasks.push(hitSite());
            }
            await Promise.all(tasks);
            return { success, fail };
        });

        await exposeControls();
        await attach(page);
    };

    return { init, attach };
}