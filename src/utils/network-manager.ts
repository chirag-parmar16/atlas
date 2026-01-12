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

    // --- EXPOSED FUNCTIONS ---
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

        // [FIX] Expose History Getter so new pages can retrieve old logs
        await page.exposeFunction('getNetworkHistory', () => {
            return requestLogHistory;
        });

        await page.exposeFunction('clearNetworkHistory', () => {
            requestLogHistory.length = 0;
            console.log('[Proxy] Network history cleared');
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

                const resHeaders: any = Object.fromEntries(response.headers.entries());
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
                await request.abort('connectionrefused');
            }
            return;
        }

        // 4. Block Other External Navigation on Main Frame
        if (isMainFrame && url.hostname !== domain && !url.hostname.includes('localhost')) {
            console.log(`[Atlas] Blocking external navigation to: ${url.hostname}`);
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

    // Initialize
    const init = async () => {
        // --- TRAFFIC SIMULATION ---
        await page.exposeFunction('startTrafficSim', async (targetUrl: string, count: number) => {
            const http = await import('http');

            console.log(`[Node] Starting traffic sim: ${count} users -> ${targetUrl}`);
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