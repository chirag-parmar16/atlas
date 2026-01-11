
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

    // --- EXPOSED FUNCTIONS ---
    // These are called by the UI via `window.setThrottling` etc.

    const exposeControls = async () => {
        await page.exposeFunction('setThrottling', (profile: string) => {
            console.log(`[Proxy] Throttling set to: ${profile}`);
            currentThrottlingProfile = profile;
        });

        await page.exposeFunction('setSecurityMode', (mode: string) => {
            console.log(`[Proxy] Security Mode set to: ${mode}`);
            currentSecurityMode = mode;
        });

        await page.exposeFunction('setChaosConfig', (config: any) => {
            console.log(`[Proxy] Chaos Config updated:`, config);
            chaosConfig = config;
        });
    };

    // --- THE IMMORTAL PILL PROXY ---
    const handleRequest = async (request: HTTPRequest, targetPage: Page) => {
        const urlString = request.url();
        const url = new URL(urlString);
        const isMainFrame = request.frame() === targetPage.mainFrame();

        // 1. ATLAS SHELL (Parent Frame)
        // Serve the Shell if requesting the root domain
        if (isMainFrame && url.hostname === domain) {
            const originalPath = url.pathname;

            // Propagate Hash for HashRouters
            const hash = url.hash || '';

            const shellHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Atlas Shell</title>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
                        #project-view { width: 100%; height: 100%; border: none; display: block; }
                    </style>
                    <script>
                        window.addEventListener('message', (event) => {
                            if (event.data && event.data.type === 'ATLAS_URL_CHANGE') {
                                // Update visible URL without reloading
                                try {
                                    window.history.replaceState(null, '', event.data.url);
                                } catch(e) {}
                            }
                        });
                    </script>
                </head>
                <body>
                    <!-- The User Project lives here, isolated -->
                    <iframe id="project-view" src="${originalPath}${url.search}${hash}"></iframe>
                    <!-- Atlas Tools will be injected here by Puppeteer -->
                </body>
                </html>
             `;

            await request.respond({
                status: 200,
                contentType: 'text/html',
                body: shellHtml
            });
            return;
        }

        // 2. ISOLATED THROTTLING (Child Frame Only)
        // Main Shell is always online.
        if (!isMainFrame) {
            if (currentThrottlingProfile === 'Offline') {
                await request.abort('failed');
                return;
            }

            // Chaos Injection
            if (chaosConfig.enabled) {
                // Drop
                if (chaosConfig.dropRate > 0 && Math.random() * 100 < chaosConfig.dropRate) {
                    await request.abort('failed');
                    return;
                }
                // Error 500
                if (chaosConfig.errorRate > 0 && Math.random() * 100 < chaosConfig.errorRate) {
                    await request.respond({
                        status: 500,
                        contentType: 'text/html',
                        body: '<h1>500 Internal Server Error (Atlas Chaos Injection)</h1>'
                    });
                    return;
                }
                // Latency
                if (chaosConfig.latencyRate > 0 && Math.random() * 100 < chaosConfig.latencyRate) {
                    const delay = 2000 + Math.random() * 3000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Throttling Latency
            let latency = 0;
            if (currentThrottlingProfile === 'Slow 4G') latency = 100;
            else if (currentThrottlingProfile === 'Fast 4G') latency = 20;

            if (latency > 0) {
                await new Promise(r => setTimeout(r, latency));
            }
        }

        // 3. PROJECT PROXY
        // Map relative Iframe requests to Localhost
        if (!isMainFrame) {
            const targetPath = url.pathname;
            const localUrl = `http://localhost:${localPort}${targetPath}${url.search}`;

            try {
                const startTime = Date.now();
                const headers = { ...request.headers(), 'x-forwarded-proto': 'https' };
                // NOTE: We rely on native fetch here (Node 18+)
                const response = await fetch(localUrl, {
                    method: request.method(),
                    headers: headers as any,
                    body: request.postData()
                });

                const buffer = await response.arrayBuffer();
                const duration = Date.now() - startTime;

                // Security & Headers Cleanup
                const resHeaders = Object.fromEntries(response.headers.entries());
                delete resHeaders['x-frame-options'];
                delete resHeaders['content-security-policy'];

                // --- LOG TO ATLAS UI ---
                const logData = {
                    id: Math.random().toString(36).substring(7),
                    url: url.href.replace(localUrl, urlString), // Restore original URL visually
                    method: request.method(),
                    status: response.status,
                    type: 'Fetch', // Simplified
                    time: duration,
                    reqHeaders: request.headers(),
                    resHeaders: resHeaders,
                    body: ''
                };

                // Capture body for details (truncate for safety)
                try {
                    if (response.headers.get('content-type')?.includes('json') || response.headers.get('content-type')?.includes('text')) {
                        const str = Buffer.from(buffer).toString('utf-8');
                        logData.body = str.length > 5000 ? str.substring(0, 5000) + '... (Truncated)' : str;
                    } else {
                        logData.body = '[Binary/Blob Data]';
                    }
                } catch (e) { }

                // Send to UI (Fire & Forget)
                if (!page.isClosed()) {
                    page.evaluate((d) => {
                        // @ts-ignore
                        if (window.Atlas && window.Atlas.logNetworkRequest) {
                            // @ts-ignore
                            window.Atlas.logNetworkRequest(d);
                        } else {
                            // Queue for later if UI not ready
                            // @ts-ignore
                            window.__ATLAS_NETWORK_QUEUE__ = window.__ATLAS_NETWORK_QUEUE__ || [];
                            // @ts-ignore
                            window.__ATLAS_NETWORK_QUEUE__.push(d);
                        }
                    }, logData).catch(() => { });
                }

                // Mixed Content Detection
                if (url.protocol === 'http:' && !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
                    try {
                        if (!page.isClosed()) {
                            page.evaluate((u) => {
                                // @ts-ignore
                                if (window.Atlas && window.Atlas.reportViolation) {
                                    // @ts-ignore
                                    window.Atlas.reportViolation('Security Warden', `Mixed Content: Insecure request to ${u}`, 1);
                                }
                            }, url.href).catch(() => { });
                        }
                    } catch (e) { }
                }

                // Strict CORS
                if (currentSecurityMode === 'Strict') {
                    const acao = resHeaders['access-control-allow-origin'];
                    if (acao && (acao === '*' || acao === 'null')) {
                        delete resHeaders['access-control-allow-origin'];
                        try {
                            if (!page.isClosed()) {
                                page.evaluate((u) => {
                                    // @ts-ignore
                                    if (window.Atlas && window.Atlas.reportViolation) {
                                        // @ts-ignore
                                        window.Atlas.reportViolation('Security Warden', `Blocked insecure CORS wildcard (*) on ${u}`, 2);
                                    }
                                }, url.pathname).catch(() => { });
                            }
                        } catch (e) { }
                    }
                }

                await request.respond({
                    status: response.status,
                    contentType: response.headers.get('content-type') || undefined,
                    headers: resHeaders,
                    body: Buffer.from(buffer)
                });

            } catch (error) {
                await request.abort('connectionrefused');
            }
            return;
        }

        // 4. BLOCK EXTERNAL NAVIGATION (Sandbox Mode)
        // Allow internal protocols and empty hostnames (often about:blank or data:)
        if (url.protocol === 'about:' || url.protocol === 'chrome:' || url.protocol === 'data:' || url.protocol === 'file:') {
            await request.continue();
            return;
        }

        if (isMainFrame && url.hostname !== domain && !url.hostname.includes('localhost')) {
            console.log(`[Atlas] Blocking external navigation to: ${url.hostname}`);
            // Just abort
            await request.abort('blockedbyclient');
            return;
        }

        await request.continue();
    };

    // Generic Attach Logic
    const attach = async (p: Page) => {
        await p.setRequestInterception(true);
        p.on('request', (req) => handleRequest(req, p));
    };

    // Initialize
    const init = async () => {
        // --- TRAFFIC SIMULATION ---
        await page.exposeFunction('startTrafficSim', async (targetUrl: string, count: number) => {
            // Dynamic import to avoid top-level node dependencies if not needed, 
            // though http is standard.
            const http = await import('http');

            console.log(`[Node] Starting traffic sim: ${count} users -> ${targetUrl}`);
            const agent = new http.Agent({ keepAlive: true, maxSockets: 1000 });

            // Rewrite URL to local server
            const urlObj = new URL(targetUrl);
            // FORCE LOCALHOST: We ignore the domain and go straight to localPort
            const realUrl = `http://localhost:${localPort}${urlObj.pathname}${urlObj.search}`;

            let success = 0;
            let fail = 0;
            let completed = 0;

            const updateBrowserContext = async () => {
                try {
                    if (page.isClosed()) {
                        console.log('[Sim] Page closed, stopping updates.');
                        return;
                    }
                    console.log(`[Sim] Updating UI: S=${success}, F=${fail}, C=${completed}`);
                    await page.evaluate((s, f, c, t) => {
                        window.dispatchEvent(new CustomEvent('atlas-traffic-update', {
                            detail: { s, f, c, total: t }
                        }));
                    }, success, fail, completed, count);
                } catch (e) {
                    console.error('[Sim] Failed to update browser context:', e);
                }
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

        // Attach to main page
        await attach(page);
    };

    return { init, attach };
}

