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
            // Execute Tools
            toolScripts.forEach(script => {
                try { new Function(script)(); } catch (e) { console.error(e); }
            });
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
                try {
                    const originalUrl = target.url();
                    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
                    await newPage.setUserAgent(ua);

                    // Optimization: Parallelize attachment
                    await Promise.all([
                        networkManager.attach(newPage),
                        injectTools(newPage)
                    ]);

                    // FORCE RELOAD to Fix Race Condition
                    if (originalUrl && originalUrl !== 'about:blank') {
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