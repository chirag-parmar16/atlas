import puppeteer, { Page } from 'puppeteer-core';
import { NetworkRequest, Violation, ChaosConfig } from '../engine/state';
import { launchElectron, killElectron } from '../electron/electron-launcher';
import { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// Engine (Brain)
import { createNetworkInterceptor } from '../engine/network-interceptor';
import { attachRecorder } from '../engine/session-recorder';
import { ReportManager } from '../engine/report-manager';

// Pipeline (Bloodline)
import { createPipeline } from '../pipeline/pipeline';

// UI Suite (Structured)


export async function launchBrowser(domain: string, localPort: number, projectPath: string, logger: (msg: string) => void = console.log, onBrowserClose?: () => void, disabledTabs: string[] = []): Promise<{
    broadcastLog: (msg: string) => void,
    close: () => Promise<void>,
    process: ChildProcess,
    reportManager: ReportManager,
    recorder: { generateLog: (targetDir: string, sessionData: { id: string, parts: string[] } | null | undefined) => Promise<string | null>, getSession: () => unknown } | null
}> {
    console.log('[Atlas] Launching Browser Orchestrator...');
    const reportManager = new ReportManager(projectPath, `localhost:${localPort}`);
    let recorderInstance: { generateLog: (targetDir: string, sessionData: { id: string, parts: string[] } | null | undefined) => Promise<string | null>, getSession: () => unknown, init: () => Promise<void> } | null = null;
    const networkManagers: { cleanup: () => Promise<void> }[] = [];
    let page: Page | null = null;

    // --- Pipeline (Bloodline): Event Bus ---
    const pipeline = createPipeline();

    // Current page local state (for HUD display)
    let currentPageViolations: Violation[] = [];
    const currentPageRequests: NetworkRequest[] = [];

    const syncHUD = async () => {
        try {
            await mainWindow.evaluate((vc, vils, reqs) => {
                // @ts-ignore
                if (window.updateViolationCount) window.updateViolationCount(vc);
                // @ts-ignore
                if (window.updateViolations) window.updateViolations(vils);
                // @ts-ignore
                if (window.updateTraffic) window.updateTraffic(reqs);
            }, currentPageViolations.length, currentPageViolations, currentPageRequests);
        } catch (e) { }
    };

    // Wire: violations → report manager & Host HUD
    pipeline.on('violation', async (v) => {
        try {
            await reportManager.logViolation(v);
            currentPageViolations.push(v);
            await syncHUD();
        } catch (e) { }
    });

    pipeline.on('network:request', async (req) => {
        currentPageRequests.push(req);
        if (currentPageRequests.length > 50) currentPageRequests.shift();
        await syncHUD();
    });

    pipeline.on('console:log', async (entry) => {
        try {
            await mainWindow.evaluate((e) => {
                // @ts-ignore
                if (window.updateConsole) window.updateConsole(e);
            }, entry);
        } catch (e) { }
    });

    pipeline.on('storage:metrics', async (m) => {
        try {
            await mainWindow.evaluate((metrics) => {
                // @ts-ignore
                if (window.updateStorage) window.updateStorage(metrics);
            }, m);
        } catch (e) { }
    });

    // Helper to scan for links (Zero Injection - just query via evaluate)
    const scanLinks = async () => {
        if (!page || page.isClosed()) return;
        try {
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                    href: (a as HTMLAnchorElement).href,
                    text: a.textContent?.trim() || ''
                }));
            });
            await mainWindow.evaluate((ls) => {
                // @ts-ignore
                if (window.updateLinks) window.updateLinks(ls);
            }, links);
        } catch (e) { }
    };

    // Trigger link scan on navigation and periodically
    pipeline.on('navigation', async (entry) => {
        try {
            await reportManager.logNavigation(entry.url);

            // Reset HUD state on navigation
            currentPageViolations = [];
            currentPageRequests.length = 0;
            await syncHUD();

            setTimeout(scanLinks, 2000); // Wait for page load
        } catch (e) { }
    });

    setInterval(scanLinks, 10000); // Periodic refresh

    // Helper to collect storage metrics
    const collectStorage = async () => {
        if (!page || page.isClosed()) return;
        try {
            const metrics = await page.evaluate(() => {
                const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
                const breakdown = { images: 0, scripts: 0, styles: 0, fonts: 0, other: 0 };
                let totalTransfer = 0;

                resources.forEach(r => {
                    totalTransfer += r.transferSize || 0;
                    if (r.initiatorType === 'img' || r.name.match(/\.(png|jpe?g|gif|webp|svg)$/)) breakdown.images += r.transferSize || 0;
                    else if (r.initiatorType === 'script' || r.name.endsWith('.js')) breakdown.scripts += r.transferSize || 0;
                    else if (r.initiatorType === 'css' || r.name.endsWith('.css')) breakdown.styles += r.transferSize || 0;
                    else if (r.initiatorType === 'font' || r.name.match(/\.(woff2?|ttf|otf)$/)) breakdown.fonts += r.transferSize || 0;
                    else breakdown.other += r.transferSize || 0;
                });

                return {
                    domSize: document.documentElement.innerHTML.length,
                    localStorageSize: Object.keys(localStorage).reduce((sum, key) => sum + (localStorage.getItem(key)?.length || 0), 0),
                    sessionStorageSize: Object.keys(sessionStorage).reduce((sum, key) => sum + (sessionStorage.getItem(key)?.length || 0), 0),
                    cookieSize: document.cookie.length,
                    totalTransfer,
                    resources: resources.slice(-5).map(r => ({ name: r.name.split('/').pop() || '', size: r.transferSize, type: r.initiatorType, duration: r.duration })),
                    breakdown
                };
            });
            pipeline.emit('storage:metrics', metrics);
        } catch (e) { }
    };

    setInterval(collectStorage, 5000); // Periodic storage refresh

    // 1. Launch Electron (replaces Chrome)
    let electronProcess: ChildProcess;
    let electronDebugPort: number;
    try {
        const electronResult = await launchElectron(domain, localPort);
        electronProcess = electronResult.electronProcess;
        electronDebugPort = electronResult.debugPort;

        // Connect puppeteer-core to Electron's CDP endpoint
        var browser = await puppeteer.connect({
            browserWSEndpoint: electronResult.wsEndpoint,
            defaultViewport: null
        });
        console.log(`[Atlas] Connected to Electron via CDP`);
    } catch (e) {
        console.error(`\n\x1b[31m[CRITICAL] Failed to launch Electron!\x1b[0m`);
        console.error((e as Error).message);
        process.exit(1);
    }

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

    // 4. Setup Pages
    const allPages = await browser.pages();
    const mainWindow = allPages[0];
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
    await mainWindow.setUserAgent(ua);

    console.log('[Atlas] Hub attached. Waiting for guest viewport...');

    // Wait for the webview target to be created by index.html
    const webviewTarget = await browser.waitForTarget(t => {
        const type = t.type();
        const url = t.url();
        // Log all targets to help debug why the webview isn't being caught
        if (type !== 'background_page') {
            console.log(`[Atlas] Scanning target: ${type} (${url})`);
        }
        return type === 'webview' || (type === 'other' && url === 'about:blank');
    }, { timeout: 15000 }).catch(err => {
        console.error('[Atlas] FATAL: Timeout waiting for Guest page. Is the HUD visible?');
        throw err;
    });

    page = await webviewTarget.page();

    if (!page) {
        throw new Error('[Atlas] Failed to attach to Guest page. Host UI may be broken.');
    }

    console.log('[Atlas] Guest page attached.');
    await page.setUserAgent(ua);

    // DEBUG: Bridge Console (Silenced for cleaner terminal)
    // page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
    // page.on('pageerror', (err: any) => console.error(`[Browser Error] ${err.toString()}`));

    // Generic Tool Injection
    const setupPage = async (targetPage: Page) => {

        // 1. Network Interceptor via Engine (wired through Pipeline)
        await targetPage.setCacheEnabled(false);
        const netInterceptor = createNetworkInterceptor(targetPage, { domain, localPort }, {
            onViolation: (v: Violation) => pipeline.emit('violation', v),
            onNetworkEvent: (r: NetworkRequest) => pipeline.emit('network:request', r),
            onLog: logger,
            onNavigation: (url: string) => pipeline.emit('navigation', { url, timestamp: Date.now() })
        });
        await netInterceptor.init();
        networkManagers.push(netInterceptor);

        // 1.5. Bridge Guest Console & Errors to Pipeline
        targetPage.on('console', async msg => {
            const level = msg.type() as any;
            const allowedLevels = ['log', 'warn', 'error', 'info', 'debug'];

            // Evaluate arguments to get real values (handles objects, multiple args)
            let message = '';
            try {
                const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
                message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            } catch (e) {
                message = msg.text(); // Fallback to simple text
            }

            pipeline.emit('console:log', {
                level: allowedLevels.includes(level) ? level : 'log',
                message: message,
                timestamp: Date.now(),
                stack: ''
            });
        });

        targetPage.on('pageerror', (err: any) => {
            pipeline.emit('violation', {
                source: 'Runtime',
                message: err.message || String(err),
                level: 2, // ERROR
                timestamp: Date.now(),
                url: targetPage.url(),
                metadata: { stack: err.stack }
            });
        });

        targetPage.on('requestfailed', req => {
            const failure = req.failure();
            if (failure && failure.errorText !== 'net::ERR_ABORTED') {
                pipeline.emit('violation', {
                    source: 'Resource',
                    message: `Failed to load ${req.url()}: ${failure.errorText}`,
                    level: 2, // ERROR
                    timestamp: Date.now(),
                    url: targetPage.url()
                });
            }
        });

        // 2. Report Manager Binding (violations flow via Pipeline)
        await targetPage.exposeFunction('atlasLogViolation', async (violation: Omit<Violation, 'type'>) => {
            pipeline.emit('violation', violation);
        });

        // 3. Inject Tools Suite (REMOVED - Moving to Host UI)


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
                        const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
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
            atlasRecordEvent: async (event: unknown) => {
                if (recorderInstance) {
                    // Logic to forward to recorder instance or log directly
                    // Note: session-recorder init already exposes this on the page
                }
            },
            setSecurityMode: async (mode: string) => {
                console.log(`[Atlas] Security Warden mode set to: ${mode}`);
                pipeline.emit('action:security-mode', mode);
            },
            setStressConfig: async (config: ChaosConfig) => {
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
        console.log('[Atlas] Shutting down Electron...');
        try {
            // Cleanup network managers (WebSocket proxies)
            for (const mgr of networkManagers) {
                try { await mgr.cleanup(); } catch (e) { }
            }

            // Pipeline cleanup
            pipeline.removeAll();

            // Disconnect puppeteer from Electron's CDP
            await browser.disconnect();

            // Kill the Electron process
            killElectron(electronProcess);
        } catch (e) { }
    };

    return {
        broadcastLog,
        close,
        process: electronProcess,
        reportManager,
        recorder: recorderInstance
    };
}