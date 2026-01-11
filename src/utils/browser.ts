import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { createNetworkManager } from './network-manager';
import { attachRecorder } from './session-recorder';

// @ts-ignore
import { UI_SHELL, TOOLS, CONSOLE, INSPECTOR, NETWORK, RECORDER, TRAFFIC, HEALTH, CHAOS } from './embedded';

export async function launchBrowser(domain: string, localPort: number, projectPath: string): Promise<{ broadcastLog: (msg: string) => void, close: () => Promise<void>, process: any }> {
    console.log('[Atlas] Launching Browser Orchestrator...');

    // 1. Resolve Chrome Path
    const installations = Launcher.getInstallations();
    const chromePath = installations.length > 0 ? installations[0] : '';

    if (!chromePath) {
        throw new Error("[Atlas] Google Chrome not found. Please install Chrome to use Atlas.");
    }
    console.log(`[Atlas] Using Chrome: ${chromePath}`);

    // 2. Launch Visible Browser
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        // @ts-ignore
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args: ['--start-maximized'],
        defaultViewport: null
    });



    // Setup Pages
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(ua);

    // Generic Tool Injection
    // @ts-ignore
    const injectTools = async (targetPage: any) => {
        const tools = [UI_SHELL, TOOLS, CONSOLE, INSPECTOR, NETWORK, RECORDER, TRAFFIC, HEALTH, CHAOS];
        // @ts-ignore
        await targetPage.evaluateOnNewDocument((toolScripts: string[]) => {
            console.log("%c[Atlas] Injecting Runtime...", "color:cyan");

            // Parent Shell Logic
            if (window.self === window.top) {
                toolScripts.forEach(script => {
                    try { new Function(script)(); } catch (e) { console.error(e); }
                });
                return;
            }

            // Child Bridge Logic
            if (window.parent !== window) {
                // 1. Console Bridge
                const originalLog = console.log;
                console.log = (...args) => {
                    originalLog.apply(console, args);
                    // @ts-ignore
                    window.parent.postMessage({ type: 'ATLAS_LOG', level: 'log', args: args.map(String) }, '*');
                };

                // 2. URL Sync Bridge (Child -> Parent)
                const notifyParentOfUrl = () => {
                    try {
                        // Strip /__app__ prefix if present to show clean URL
                        const path = window.location.pathname.replace('/__app__', '') || '/';
                        const url = path + window.location.search + window.location.hash;
                        window.parent.postMessage({ type: 'ATLAS_URL_CHANGE', url: url }, '*');
                    } catch (e) { }
                };

                // Monkey Patch History API for SPA support
                const wrapHistory = (type: string) => {
                    const orig = history[type as keyof History];
                    return function (this: History, ...args: any[]) {
                        // @ts-ignore
                        const rv = orig.apply(this, args);
                        notifyParentOfUrl();
                        return rv;
                    };
                };
                history.pushState = wrapHistory('pushState');
                history.replaceState = wrapHistory('replaceState');
                window.addEventListener('popstate', notifyParentOfUrl);

                // Initial Sync
                notifyParentOfUrl();
            }
        }, tools);
    };

    // 4. Attach Modules
    const networkManager = createNetworkManager(page, { domain, localPort });
    await networkManager.init();

    const recorder = attachRecorder(page, { projectPath });
    await recorder.init();

    // 5. Inject Tools (Main Page)
    await injectTools(page);

    // 3. Navigation Lock & Multi-Tab Support
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage && newPage !== page) {
                // Setup new page with same environment
                try {
                    const originalUrl = target.url();
                    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
                    await newPage.setUserAgent(ua);

                    // Optimization: Parallelize attachment
                    await Promise.all([
                        networkManager.attach(newPage),
                        injectTools(newPage)
                    ]);

                    // FORCE RELOAD to Fix Race Condition: 
                    // The browser often fires the first request before interception is ready, causing SSL errors.
                    // We simply reload the page through our now-active interceptor.
                    if (originalUrl && originalUrl !== 'about:blank') {
                        // Use load to avoid hanging on networkidle if stream is active
                        await newPage.goto(originalUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
                    }


                } catch (e) {
                    console.error("Failed to setup new page", e);
                }
            }
        }
    });


    // 6. Navigation
    try {
        console.log(`[Atlas] Navigating to https://${domain}...`);
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error("Navigation failed", e);
    }


    // 7. Bridge & Cleanup Interface
    const broadcastLog = (msg: string) => {
        try {
            if (!page.isClosed()) {
                page.evaluate((m) => {
                    window.dispatchEvent(new CustomEvent('atlas-console-log', {
                        detail: { type: 'log', message: `[Server] ${m}`, time: new Date().toLocaleTimeString() }
                    }));
                }, msg).catch(() => { });
            }
        } catch (e) { }
    };

    const close = async () => {
        console.log('[Atlas] Shutting down browsers...');
        try {
            // Generate manual before closing
            await recorder.generateLog();
        } catch (e) { }


        try { await browser.close(); } catch (e) { }
    };

    return {
        broadcastLog,
        close,
        process: browser.process()
    };
}