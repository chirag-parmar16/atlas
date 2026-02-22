import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Engine (Brain)
import { createNetworkInterceptor } from '../engine/network-interceptor';
import { attachRecorder } from '../engine/session-recorder';
import { ReportManager } from '../engine/report-manager';

// Pipeline (Bloodline)
import { createPipeline } from '../pipeline/pipeline';

// UI Suite (Structured)
import { injectAtlasUI } from '../ui/injection';
import { CLOSER } from '../ui/components';

export async function launchBrowser(domain: string, localPort: number, projectPath: string, logger: (msg: string) => void = console.log, onBrowserClose?: () => void): Promise<{
    broadcastLog: (msg: string) => void,
    close: () => Promise<void>,
    process: any,
    reportManager: ReportManager,
    recorder: { generateLog: (targetDir: string, sessionData: any) => Promise<string | null>, getSession: () => any }
}> {
    console.log('[Atlas] Launching Browser Orchestrator...');
    const reportManager = new ReportManager(projectPath, `localhost:${localPort}`);
    let recorderInstance: any = null;
    const networkManagers: any[] = [];

    // --- Pipeline (Bloodline): Event Bus ---
    const pipeline = createPipeline();

    // Wire: violations → report manager
    pipeline.on('violation', async (v) => {
        try { await reportManager.logViolation(v); } catch (e) { }
    });

    // Wire: navigations → report manager (with delayed metrics)
    pipeline.on('navigation', async (entry) => {
        try { await reportManager.logNavigation(entry.url); } catch (e) { }
    });

    // BUG-001: Temporary Profile Directory
    const profileDir = path.join(os.tmpdir(), `atlas-profile-${Date.now()}`);

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
        args: [
            `--user-data-dir=${profileDir}`,            // BUG-001: Isolated Profile
            '--force-app-mode',                         // More aggressive app mode force
            '--kiosk',                                  // Start in kiosk mode
            '--disable-pinch',                          // Prevent pinch zoom
            '--overscroll-history-navigation=disabled'   // Prevent swipe navigation
        ],
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

        // 1. Network Interceptor via Engine (wired through Pipeline)
        await targetPage.setCacheEnabled(false);
        const netInterceptor = createNetworkInterceptor(targetPage, { domain, localPort }, {
            onViolation: (v: any) => pipeline.emit('violation', v),
            onNetworkEvent: (r: any) => pipeline.emit('network:request', r),
            onLog: logger,
            onNavigation: (url: string) => pipeline.emit('navigation', { url, timestamp: Date.now() })
        });
        await netInterceptor.init();
        networkManagers.push(netInterceptor);

        // 2. Report Manager Binding (violations flow via Pipeline)
        await targetPage.exposeFunction('atlasLogViolation', async (violation: any) => {
            pipeline.emit('violation', violation);
        });

        // 3. Inject Tools Suite
        await injectAtlasUI(targetPage, { domain, port: localPort });

        // 3. Recorder (Single instance attached to main page? Or per page?)
        // Recorder typically records the *tab* it was attached to. 
        // For now, let's keep it simple: Attach recorder to every page but only the user controls one? 
        // 3. Attach Recorder
        const rec = attachRecorder(targetPage, reportManager);
        await rec.init();
        if (!recorderInstance) recorderInstance = rec; // Track the first one as primary

        // 4. Navigation Tracker


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

        // Reusable logging function for SPA / Initial Load
        const logNav = async (url?: string) => {
            const currentUrl = url || targetPage.url();
            if (!currentUrl || currentUrl === 'about:blank') return;

            // Wait for load event approx to get metrics
            setTimeout(async () => {
                if (targetPage.isClosed()) return;
                try {
                    const metrics = await targetPage.evaluate(() => {
                        const timing = performance.getEntriesByType('navigation')[0] as any;
                        const loadTime = timing ? (timing.loadEventEnd || timing.domComplete || 0) : 0;

                        // 2. Storage
                        let storageBytes = 0;
                        try {
                            Object.keys(localStorage).forEach(k => storageBytes += (localStorage[k].length + k.length));
                            Object.keys(sessionStorage).forEach(k => storageBytes += (sessionStorage[k].length + k.length));
                            storageBytes += document.cookie.length;
                        } catch (e) { }

                        return {
                            loadTime: Math.round(loadTime),
                            storage: Number((storageBytes / 1024).toFixed(2)) // KB with 2 decimals
                        };
                    });

                    // Ensure metrics are valid numbers
                    if (metrics) {
                        if (isNaN(metrics.loadTime)) metrics.loadTime = 0;
                        if (isNaN(metrics.storage)) metrics.storage = 0;
                    }

                    await reportManager.logNavigation(currentUrl, metrics);
                } catch (e) {
                    await reportManager.logNavigation(currentUrl);
                }
            }, 2000); // Slight delay to allow load to finish
        };

        await targetPage.exposeFunction('atlasLogNavigation', async (url?: string) => {
            await logNav(url);
        });

        // 5. Initial Log for this page
        await logNav();

        // 6. Browser Bridge Functions (Close + Navigation)
        const bridgeFunctions: Record<string, Function> = {
            atlasCloseBrowser: async () => {
                console.log('[Atlas] Close requested from Browser HUD.');
                // 1. Inject Closer Animation
                try {
                    await targetPage.evaluate((script: string) => { new Function(script)(); }, CLOSER);
                    await new Promise(r => setTimeout(r, 3000)); // 3s delay
                } catch (e) { }

                if (onBrowserClose) onBrowserClose();
                else { await close(); process.exit(0); }
            },
            atlasGoBack: async () => { try { await targetPage.goBack(); } catch (e) { } },
            atlasGoForward: async () => { try { await targetPage.goForward(); } catch (e) { } },
            atlasMinimizeWindow: async () => {
                try {
                    const session = await targetPage.target().createCDPSession();
                    const { windowId } = await session.send('Browser.getWindowForTarget');
                    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
                } catch (e) { console.error("Minimize failed", e); }
            },
            atlasToggleWindowMode: async () => {
                try {
                    const session = await targetPage.target().createCDPSession();
                    const { windowId, bounds } = await session.send('Browser.getWindowForTarget');
                    const newState = bounds.windowState === 'normal' ? 'maximized' : 'normal';
                    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: newState } });
                } catch (e) { console.error("Window toggle failed", e); }
            },
            // --- RESTORED RECORDING BRIDGES ---
            atlasStartRecording: async () => {
                const rec = recorderInstance || attachRecorder(targetPage, reportManager);
                if (!recorderInstance) {
                    recorderInstance = rec;
                    await rec.init();
                }
                return await targetPage.evaluate(() => {
                    // @ts-ignore
                    if (window.atlasStartRecording) return window.atlasStartRecording();
                    return false;
                });
            },
            atlasStopRecording: async () => {
                return await targetPage.evaluate(() => {
                    // @ts-ignore
                    if (window.atlasStopRecording) return window.atlasStopRecording();
                    return null;
                });
            },
            atlasRecordEvent: async (event: any) => {
                if (recorderInstance) {
                    // Logic to forward to recorder instance or log directly
                    // Note: session-recorder init already exposes this on the page
                }
            },
            setSecurityMode: async (mode: string) => {
                console.log(`[Atlas] Security Warden mode set to: ${mode}`);
                pipeline.emit('action:security-mode', mode);
            },
            setStressConfig: async (config: any) => {
                console.log(`[Atlas] Stress testing config updated`, config);
                pipeline.emit('action:stress', config);
            }
        };
        for (const [name, fn] of Object.entries(bridgeFunctions)) {
            try { await targetPage.exposeFunction(name, fn); } catch (e) { /* Already exposed */ }
        }
    };

    // 4. Attach Modules (Initial Page)
    await setupPage(page);


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
                    await injectAtlasUI(newPage, { domain, port: localPort });


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

        console.log(`[Atlas] Navigating to ${protocol}${domain}...`);

        await page.goto(`${protocol}${domain}`, {
            waitUntil: 'domcontentloaded'
        });

        // Explicitly log the starting page to ensure it's ALWAYS Step 1
        await reportManager.logNavigation(page.url());

    } catch (e) {
        console.error("Navigation failed", e);
    }

    // 7. Browser Disconnect Handler — graceful cleanup when browser is closed manually
    browser.on('disconnected', () => {
        console.log('\n[Atlas] Browser was closed. Ending session...');
        if (onBrowserClose) onBrowserClose();
        else process.exit(0);
    });

    // 8. Bridge & Cleanup Interface
    const broadcastLog = (msg: string) => {
        try {
            if (!page.isClosed()) {
                page.evaluate((m: string) => {
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
            // BUG-002: Cleanup network managers (WebSocket proxies)
            for (const mgr of networkManagers) {
                try { await mgr.cleanup(); } catch (e) { }
            }

            // Pipeline cleanup
            pipeline.removeAll();

            await browser.close();

            // BUG-001: Delete temporary profile
            if (fs.existsSync(profileDir)) {
                try {
                    // Recursive sync deletion is safest for cleanup on exit
                    fs.rmSync(profileDir, { recursive: true, force: true });
                } catch (e) { }
            }
        } catch (e) { }
    };

    return {
        broadcastLog,
        close,
        process: browser.process(),
        reportManager,
        recorder: recorderInstance
    };
}