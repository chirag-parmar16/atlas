import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { createNetworkManager } from './network-manager';
import { attachRecorder } from './session-recorder';

// @ts-ignore
import { UI_SHELL, TOOLS, INSPECTOR, NETWORK, RECORDER, HEALTH, CHAOS, LINKS } from './embedded';

export async function launchBrowser(domain: string, localPort: number, projectPath: string): Promise<{ broadcastLog: (msg: string) => void, close: () => Promise<void>, process: any }> {
    console.log('[Atlas] Launching Browser Orchestrator...');

    // 1. Resolve Chrome Path
    let chromePath = '';
    try {
        const installations = Launcher.getInstallations();
        chromePath = installations.length > 0 ? installations[0] : '';
    } catch (e) {
        console.warn(`[Atlas] Warning: Failed to auto-detect Chrome: ${(e as any).message}`);
    }

    if (!chromePath) {
        console.error(`\n\x1b[31m[CRITICAL] Google Chrome not found!\x1b[0m`);
        console.error(`Atlas requires Google Chrome to be installed on your system.`);
        console.error(`Please install Chrome and try again: \x1b[36mhttps://www.google.com/chrome/\x1b[0m\n`);

        // Graceful exit instead of crash
        process.exit(1);
    }
    console.log(`[Atlas] Using Chrome: ${chromePath}`);

    // 2. Check FFmpeg Availability (Required for Session Recording)
    let ffmpegAvailable = false;
    try {
        const ffmpeg = require('@ffmpeg-installer/ffmpeg');
        if (ffmpeg.path) {
            ffmpegAvailable = true;
            console.log(`[Atlas] FFmpeg detected: ${ffmpeg.path}`);
        }
    } catch (e) {
        // FFmpeg package not available
    }

    if (!ffmpegAvailable) {
        console.warn(`\n\x1b[33m[WARNING] FFmpeg not found!\x1b[0m`);
        console.warn(`Atlas requires FFmpeg for session recording functionality.\n`);
        console.warn(`Installation Instructions:`);
        console.warn(`  Windows: choco install ffmpeg  OR  Download from \x1b[36mhttps://ffmpeg.org/download.html\x1b[0m`);
        console.warn(`  macOS:   brew install ffmpeg`);
        console.warn(`  Linux:   sudo apt install ffmpeg  OR  sudo yum install ffmpeg\n`);
        console.warn(`You can continue without FFmpeg, but recording will be disabled.\n`);
    }

    // 3. Launch Visible Browser
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

    // DEBUG: Bridge Console (Silenced for cleaner terminal)
    // page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
    // page.on('pageerror', (err: any) => console.error(`[Browser Error] ${err.toString()}`));

    // Generic Tool Injection
    // @ts-ignore
    const setupPage = async (targetPage: any) => {
        const tools = [UI_SHELL, TOOLS, INSPECTOR, NETWORK, RECORDER, HEALTH, CHAOS, LINKS];

        // 1. Network Manager (Isolated per page)
        const netMgr = createNetworkManager(targetPage, { domain, localPort });
        await netMgr.init();

        // 2. Inject Tools
        // @ts-ignore
        await targetPage.evaluateOnNewDocument((toolScripts: string[]) => {
            console.log("%c[Atlas] Injecting Runtime...", "color:cyan");
            toolScripts.forEach(script => {
                try {
                    new Function(script)();
                } catch (e: any) {
                    console.error('[Atlas Runtime Error]', e.message, e.stack);
                }
            });
        }, tools);

        // 3. Recorder (Single instance attached to main page? Or per page?)
        // Recorder typically records the *tab* it was attached to. 
        // For now, let's keep it simple: Attach recorder to every page but only the user controls one? 
        // Actually, recorder.ts is designed to attach only once. Let's keep recorder on Main Page only for now or re-evaluate.
        // The original code passed 'recorder' log generation to 'close'.
        // Let's only attach recorder to the initial page to avoid conflict, or if needed we can attach to all. 
        // Given visual-manual is likely single-session, let's attach to all but they might overwrite properties. 
        // Safe bet: Attach to all.
        // const rec = attachRecorder(targetPage, { projectPath });
        // await rec.init();
    };

    // 4. Attach Modules (Initial Page)
    await setupPage(page);

    // Attach Recorder specifically to the main page (Controller)
    const recorder = attachRecorder(page, { projectPath });
    await recorder.init();

    const runToolsNow = async (p: any) => {
        const tools = [UI_SHELL, TOOLS, INSPECTOR, NETWORK, RECORDER, HEALTH, CHAOS, LINKS];

        await p.evaluate((toolScripts: string[]) => {
            toolScripts.forEach(script => {
                try {
                    new Function(script)();
                } catch (e: any) {
                    console.error('[Atlas Runtime Error]', e.message, e.stack);
                }
            });
        }, tools);
    };
    await runToolsNow(page);

    // 3. Navigation Lock & Multi-Tab Support
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage && newPage !== page) {
                try {
                    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
                    await newPage.setUserAgent(ua);

                    // Setup isolated tools for new tab
                    await setupPage(newPage);

                    // Inject immediately into current context
                    await runToolsNow(newPage);

                    // REMOVED: Force Reload (Fixed Double Load)
                } catch (e) {
                    console.error("Failed to setup new page", e);
                }
            }
        }
    });

    // 6. Navigation
    try {
        console.log(`[Atlas] Navigating to https://${domain}...`);
        // Fix: Use domcontentloaded instead of networkidle0 for reliability
        const isLocal =
            domain.includes('localhost') ||
            domain.startsWith('127.') ||
            domain.endsWith('.local');

        const protocol = isLocal ? 'http://' : 'https://';

        await page.goto(`${protocol}${domain}`, {
            waitUntil: 'domcontentloaded'
        });


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
            // REDUNDANT: Manual reports only now
            // await recorder.generateLog();
        } catch (e) { }
        try { await browser.close(); } catch (e) { }
    };

    return {
        broadcastLog,
        close,
        process: browser.process()
    };
}