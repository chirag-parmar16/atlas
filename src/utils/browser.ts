import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { createNetworkManager } from './network-manager';
import { attachRecorder } from './session-recorder';
import { ReportManager } from './report-manager';

// @ts-ignore
import { UI_SHELL, RECORDER, LINKS, STABILITY, SECURITY_MONITOR, EXTRAS } from './embedded';

export async function launchBrowser(domain: string, localPort: number, projectPath: string): Promise<{
    broadcastLog: (msg: string) => void,
    close: () => Promise<void>,
    process: any,
    reportManager: ReportManager,
    recorder: { generateLog: (targetDir: string, sessionData: any) => Promise<string | null>, getSession: () => any }
}> {
    console.log('[Atlas] Launching Browser Orchestrator...');
    const reportManager = new ReportManager(projectPath, `localhost:${localPort}`);
    let recorderInstance: any = null;

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
        const tools = [UI_SHELL, RECORDER, LINKS, STABILITY, SECURITY_MONITOR, EXTRAS];

        // 1. Network Manager (Isolated per page)
        const netMgr = createNetworkManager(targetPage, { domain, localPort }, reportManager);
        await netMgr.init();

        // 2. Report Manager Binding
        await targetPage.exposeFunction('atlasLogViolation', async (violation: any) => {
            await reportManager.logViolation(violation);
        });

        // 3. Inject Tools
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
        // 3. Attach Recorder
        const rec = attachRecorder(targetPage, reportManager);
        await rec.init();
        if (!recorderInstance) recorderInstance = rec; // Track the first one as primary

        // 4. Navigation Tracker
        let lastUrl = '';
        const logNav = async (url?: string) => {
            const currentUrl = url || targetPage.url();
            if (!currentUrl || currentUrl === 'about:blank') return;
            if (currentUrl === lastUrl) return;
            lastUrl = currentUrl;
            await reportManager.logNavigation(currentUrl);
        };

        targetPage.on('framenavigated', async (frame: any) => {
            if (frame === targetPage.mainFrame()) {
                await logNav(targetPage.url());
            }
        });

        // Catch SPA transitions (Back, Forward, Fragment, History)
        await targetPage.evaluateOnNewDocument(() => {
            const log = () => {
                // @ts-ignore
                if (window.atlasLogNavigation) window.atlasLogNavigation(window.location.href);
            };
            window.addEventListener('hashchange', log);
            window.addEventListener('popstate', log);

            const originalPushState = history.pushState;
            history.pushState = function () {
                // @ts-ignore
                originalPushState.apply(this, arguments);
                log();
            };

            const originalReplaceState = history.replaceState;
            history.replaceState = function () {
                // @ts-ignore
                originalReplaceState.apply(this, arguments);
                log();
            };
        });

        await targetPage.exposeFunction('atlasLogNavigation', async (url?: string) => {
            await logNav(url);
        });

        // 5. Initial Log for this page
        await logNav();
    };

    // 4. Attach Modules (Initial Page)
    await setupPage(page);


    const runToolsNow = async (p: any) => {
        const tools = [UI_SHELL, RECORDER, LINKS, STABILITY, SECURITY_MONITOR, EXTRAS];

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

    // Initial HUD Update
    await page.evaluate((d, p) => {
        // @ts-ignore
        if (window.Atlas && window.Atlas.updateHUD) window.Atlas.updateHUD(d, p, 'NO LIMIT');
        // Enable Device Mode by default for "Showcase" feel? Maybe optional.
        // Let's leave it off by default but enable explicit hazard border.
    }, domain, localPort);


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

                    // Update HUD for new tab
                    await newPage.evaluate((d, p) => {
                        // @ts-ignore
                        if (window.Atlas && window.Atlas.updateHUD) window.Atlas.updateHUD(d, p, 'NO LIMIT');
                    }, domain, localPort);


                    // REMOVED: Force Reload (Fixed Double Load)
                } catch (e) {
                    console.error("Failed to setup new page", e);
                }
            }
        }
    });

    // 6. Navigation
    try {
        const isLocal =
            domain.includes('localhost') ||
            domain.startsWith('127.') ||
            domain.endsWith('.local') ||
            domain.endsWith('.test') ||
            !domain.includes('.'); // Single word like 'test', 'dev'

        const protocol = isLocal ? 'http://' : 'https://';

        await page.goto(`${protocol}${domain}`, {
            waitUntil: 'domcontentloaded'
        });

        // Explicitly log the starting page to ensure it's ALWAYS Step 1
        await reportManager.logNavigation(page.url());

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
        try { await browser.close(); } catch (e) { }
    };

    return {
        broadcastLog,
        close,
        process: browser.process(),
        reportManager,
        recorder: recorderInstance
    };
}