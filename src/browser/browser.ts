import puppeteer, { Page, Browser, Target } from 'puppeteer-core';
import { NetworkRequest, Violation, ChaosConfig, ConsoleEntry, StorageMetrics } from '../engine/state';
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

// Collectors (Eyes & Ears)
import { startStorageMetricsCollector } from '../collectors/storage-metrics';
import { startLinkScanner, scanLinksForPage } from '../collectors/link-scanner';

// Pipeline Event Types
export interface PipelineEventPayload {
    'violation': Violation;
    'network:request': NetworkRequest & { tabId?: string };
    'console:log': { level: string, message: string, timestamp: number, stack?: string, tabId?: string };
    'storage:metrics': {
        domSize: number;
        localStorageSize: number;
        sessionStorageSize: number;
        cookieSize: number;
        totalTransfer: number;
        resources: Record<string, unknown>[];
        breakdown: Record<string, number>;
        tabId?: string;
    };
    'action:security-mode': string;
    'action:stress': ChaosConfig;
    'navigation': { url: string, timestamp: number, tabId?: string };
}

// UI Suite (Structured)


export async function launchBrowser(domain: string, localPort: number, projectPath: string, logger: (msg: string) => void = console.log, onBrowserClose?: () => void, disabledTabs: string[] = [], projectName: string = ''): Promise<{
    broadcastLog: (msg: string) => void,
    close: () => Promise<void>,
    process: ChildProcess,
    reportManager: ReportManager
}> {
    console.log('[Atlas] Launching Browser Orchestrator...');
    const reportManager = new ReportManager(projectPath, `localhost:${localPort}`);
    let browser: Browser;
    let electronProcess: ChildProcess;
    let electronDebugPort: number;

    try {
        const electronResult = await launchElectron(domain, localPort, projectName, disabledTabs);
        electronProcess = electronResult.electronProcess;
        electronDebugPort = electronResult.debugPort;

        browser = await puppeteer.connect({
            browserWSEndpoint: electronResult.wsEndpoint,
            defaultViewport: null
        });
        console.log(`[Atlas] Connected to Electron via CDP`);
    } catch (e) {
        console.error(`\n\x1b[31m[CRITICAL] Failed to launch Electron!\x1b[0m`);
        console.error((e as Error).message);
        process.exit(1);
    }

    const allPages = await browser.pages();
    const mainWindow = allPages[0];

    const networkManagers: { cleanup: () => Promise<void> }[] = [];
    let page: Page | null = null;
    const activePages = new Set<Page>();
    const pageToTabId = new Map<Page, string>();

    // --- Pipeline (Bloodline): Event Bus ---
    const pipeline = createPipeline();

    // Violations accumulate and sync to active tab via syncHUD
    let currentViolations: { source: string, message: string, level: number, timestamp: number, url: string }[] = [];

    const syncHUD = async () => {
        try {
            checkTabSwitch();
            const vils = currentViolations.slice();
            await mainWindow.evaluate((count: number, v: Record<string, unknown>[]) => {
                // @ts-ignore
                if (window.updateViolationCount) window.updateViolationCount(count);
                // @ts-ignore
                if (window.updateViolations) window.updateViolations(v);
            }, vils.length, vils);
        } catch (e) {
            console.error('[Atlas] syncHUD error:', (e as Error).message);
        }
    };

    // Wire: violations → report manager & Host HUD
    pipeline.on('violation', async (v) => {
        try {
            await reportManager.logViolation(v);
            currentViolations.push({
                source: String(v.source || ''),
                message: String(v.message || ''),
                level: Number(v.level || 0),
                timestamp: Number(v.timestamp || Date.now()),
                url: String(v.url || '')
            });
            await syncHUD();
        } catch (e) {
            console.error('[Atlas] violation handler error:', (e as Error).message);
        }
    });

    // Network requests: push INDIVIDUALLY to renderer (per-tab store accumulates them)
    // This ensures each request goes into whichever tab is active at that moment
    // Network requests: push INDIVIDUALLY to renderer
    pipeline.on('network:request', async (req: Partial<NetworkRequest> & { tabId?: string }) => {
        try {
            const r = {
                id: String(req.id || Math.random().toString(36).substr(2, 8)),
                url: String(req.url || ''),
                method: String(req.method || 'GET'),
                status: Number(req.status || 0),
                type: String(req.type || 'Other'),
                size: Number(req.size || 0),
                time: Number(req.time || 0),
                timestamp: Date.now()
            };
            await mainWindow.evaluate((request: Partial<NetworkRequest>, tId: string) => {
                // @ts-ignore
                if (window.addNetworkRequest) window.addNetworkRequest(request, tId);
            }, r, req.tabId || '');
        } catch (e) {
            console.error('[Atlas] Failed to push network request to UI:', (e as Error).message);
        }
    });

    pipeline.on('console:log', async (entry: Partial<ConsoleEntry> & { tabId?: string }) => {
        try {
            await mainWindow.evaluate((e: Partial<ConsoleEntry>, tId: string) => {
                // @ts-ignore
                if (window.updateConsole) window.updateConsole(e, tId);
            }, entry, entry.tabId || '');
        } catch (e) {
            console.error('[Atlas] Failed to push console log to UI:', (e as Error).message);
        }
    });

    pipeline.on('storage:metrics', async (m: StorageMetrics & { tabId?: string }) => {
        try {
            await mainWindow.evaluate((metrics: StorageMetrics, tId: string) => {
                // @ts-ignore
                if (window.updateStorage) window.updateStorage(metrics, tId);
            }, m, m.tabId || '');
        } catch (e) {
            console.error('[Atlas] Failed to push storage metrics to UI:', (e as Error).message);
        }
    });

    // When renderer switches tabs it sets a global flag in electron-main (via IPC)
    // We poll it on every syncHUD tick and clear HUD data when a tab switch is detected
    let lastKnownTabKey = '';
    const checkTabSwitch = () => {
        const currentKey = String((global as { __atlasActiveTabUrl?: string }).__atlasActiveTabUrl || '');
        if (currentKey && currentKey !== lastKnownTabKey) {
            lastKnownTabKey = currentKey;
            currentViolations = [];
        }
    };

    const userAgentStr = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';

    // Initialize Collectors
    const cleanupLinkScanner = startLinkScanner(
        () => activePages,
        pageToTabId,
        () => mainWindow,
        pipeline,
        userAgentStr
    );

    const cleanupStorageMetrics = startStorageMetricsCollector(
        () => page,
        pipeline,
        15000
    );

    // Trigger report manager and clear violations on navigation
    pipeline.on('navigation', async (entry: { url: string, timestamp: number, tabId?: string }) => {
        try {
            await reportManager.logNavigation(entry.url);

            // Reset violations on navigation
            currentViolations = [];
            await syncHUD();
        } catch (e) {
            console.error('[Atlas] Navigation pipeline handler error:', (e as Error).message);
        }
    });

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

    await mainWindow.setUserAgent(userAgentStr);

    // Expose a function in the HOST WINDOW JS context so tab-manager.ts can call it.
    // When user switches tabs, this clears HUD data so old tab's data is not shown for the new tab.
    // exposeFunction creates a bridge: renderer JS → Node.js (browser.ts) — the correct pattern.
    await mainWindow.exposeFunction('__atlasTabSwitched', () => {
        currentViolations = [];
        console.log('[Atlas] Tab switched — HUD violations cleared.');
    }).catch(() => { }); // Ignore if already exposed (hot reload)

    console.log('[Atlas] Hub attached. Waiting for guest viewport...');

    // Wait for the webview target to be created by index.html
    const webviewTarget = await browser.waitForTarget((t: Target) => {
        const type = t.type();
        const url = t.url();
        // Log all targets to help debug why the webview isn't being caught
        if (type !== 'background_page') {
            console.log(`[Atlas] Scanning target: ${type} (${url})`);
        }
        return type === 'webview' || (type === 'other' && url === 'about:blank');
    }, { timeout: 15000 }).catch((err: Error) => {
        console.error('[Atlas] FATAL: Timeout waiting for Guest page. Is the HUD visible?');
        throw err;
    });

    page = await webviewTarget.page();

    if (!page) {
        throw new Error('[Atlas] Failed to attach to Guest page. Host UI may be broken.');
    }

    console.log('[Atlas] Guest page attached.');
    await page.setUserAgent(userAgentStr);

    // DEBUG: Bridge Console (Silenced for cleaner terminal)
    // page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
    // page.on('pageerror', (err: Error) => console.error(`[Browser Error] ${err.toString()}`));

    // Generic Tool Injection
    const setupPage = async (targetPage: Page) => {
        if (activePages.has(targetPage)) return;
        activePages.add(targetPage);

        console.log(`[Atlas] [DEBUG] setupPage start for: ${targetPage.url()}`);

        // Fetch the tabId injected by Electron
        let tabId = '';
        try {
            // Wait up to 2s for identity to be injected
            for (let i = 0; i < 20; i++) {
                tabId = await targetPage.evaluate(() => (window as { __atlasTabId?: string }).__atlasTabId) || '';
                if (tabId) break;
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (e) { }

        if (tabId) {
            pageToTabId.set(targetPage, tabId);
            console.log(`[Atlas] [DEBUG] Mapped page ${targetPage.url()} to tabId: ${tabId}`);
        }

        // 1. Network Interceptor via Engine (wired through Pipeline)
        await targetPage.setCacheEnabled(false);
        const netInterceptor = createNetworkInterceptor(targetPage, { domain, localPort }, {
            onViolation: (v: Violation) => pipeline.emit('violation', { ...v, tabId }),
            onNetworkEvent: (r: NetworkRequest) => pipeline.emit('network:request', { ...r, tabId }),
            onLog: logger,
            onNavigation: (url: string) => pipeline.emit('navigation', { url, timestamp: Date.now(), tabId })
        });
        console.log(`[Atlas] [DEBUG] Initializing netInterceptor...`);
        await netInterceptor.init();
        console.log(`[Atlas] [DEBUG] netInterceptor initialized.`);
        networkManagers.push(netInterceptor);

        // 1.5. Bridge Guest Console & Errors to Pipeline
        targetPage.on('console', async msg => {
            const level = msg.type() as 'log' | 'warn' | 'error' | 'info' | 'debug';
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

            // Console warnings and errors count as violations
            if (level === 'warn' || level === 'error') {
                pipeline.emit('violation', {
                    source: 'Console',
                    message: `[${level.toUpperCase()}] ${message}`,
                    level: level === 'error' ? 2 : 1, // ERROR=2, WARNING=1
                    timestamp: Date.now(),
                    url: targetPage.url()
                });
            }
        });

        targetPage.on('pageerror', (err: unknown) => {
            const error = err as Error;
            pipeline.emit('violation', {
                source: 'Runtime',
                message: error.message || String(error),
                level: 2, // ERROR
                timestamp: Date.now(),
                url: targetPage.url(),
                metadata: { stack: error.stack }
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
        // --- DEPRECATED: Recording is now handled Natively in the Electron Main/Renderer Process ---
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
            atlasGoBack: async () => { try { await targetPage.goBack(); } catch (e) { console.error("GoBack failed", e) } },
            atlasGoForward: async () => { try { await targetPage.goForward(); } catch (e) { console.error("GoForward failed", e) } },
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
            // --- DEPRECATED: Recording is now handled Natively in the Electron Main/Renderer Process ---
            atlasStartRecording: async () => false,
            atlasStopRecording: async () => null,
            atlasTogglePause: async () => { },
            atlasRecordEvent: async () => { },
            setSecurityMode: async (mode: string) => {
                console.log(`[Atlas] Security Warden mode set to: ${mode}`);
                pipeline.emit('action:security-mode', mode);
            },
            setStressConfig: async (config: ChaosConfig) => {
                console.log(`[Atlas] Stress testing config updated`, config);
                pipeline.emit('action:stress', config);
            },
            atlasGetTabId: async () => tabId
        };

        console.log(`[Atlas] [DEBUG] Exposing bridge functions to guest...`);
        for (const [name, fn] of Object.entries(bridgeFunctions)) {
            try {
                await targetPage.exposeFunction(name, fn);
            } catch (e) {
                // Function already exposed - safe to ignore on navigations
            }
        }
        console.log(`[Atlas] [DEBUG] setupPage complete for: ${targetPage.url()}`);
    };

    // 4. Attach Modules (Initial Page)
    if (page) await setupPage(page);

    // 3. Navigation Lock & Multi-Tab Support
    browser.on('targetcreated', async (target: Target) => {
        const url = target.url();
        const type = target.type();
        if ((type === 'page' || type === 'webview' || type === 'other') && !url.includes('index.html') && url !== 'about:blank') {
            const newPage = await target.page();
            if (newPage) {
                try {
                    const userAgentStr = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ATLAS/1.0 Chrome/120.0.0.0 Safari/537.36';
                    await newPage.setUserAgent(userAgentStr);
                    await setupPage(newPage);
                    page = newPage;
                } catch (e) {
                    console.error('[Atlas] Error setting up new target page:', (e as Error).message);
                }
            }
        }
    });

    browser.on('targetdestroyed', async (target: Target) => {
        const p = await target.page();
        if (p) {
            activePages.delete(p);
            pageToTabId.delete(p);
        }
    });

    // 6. Navigation
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const isLocal =
                domain.includes('localhost') ||
                domain.startsWith('127.') ||
                domain.endsWith('.local') ||
                domain.endsWith('.test') ||
                !domain.includes('.'); // Single word like 'test', 'dev'

            const protocol = isLocal ? 'http://' : 'https://';
            const url = `${protocol}${domain}`;

            if (i === 0) console.log(`[Atlas] Navigating to ${url}...`);
            else console.log(`[Atlas] Navigation retry ${i}/${maxRetries} to ${url}...`);

            await page!.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Explicitly log the starting page to ensure it's ALWAYS Step 1
            await reportManager.logNavigation(page!.url());
            break; // Success!

        } catch (e) {
            const err = e as Error;
            console.warn(`[Atlas] Navigation attempt ${i + 1} failed: ${err.message}`);

            if (err.message.includes('Session closed') || err.message.includes('Target closed') || err.message.includes('detached Frame')) {
                // Process swap or target loss occurred. 
                console.log(`[Atlas] [DEBUG] Session/Target/Frame lost. Attempting to re-find guest page...`);
                await new Promise(r => setTimeout(r, 2000));

                // Re-find the webview target robustly
                const targets = await browser.targets();
                const newWebview = targets.find((t: Target) => {
                    const type = t.type();
                    const url = t.url();
                    return type === 'webview' || (type === 'other' && url === 'about:blank') || (type === 'page' && !url.includes('index.html'));
                });

                if (newWebview) {
                    const newGuestPage = await newWebview.page();
                    if (newGuestPage) {
                        page = newGuestPage;
                        console.log(`[Atlas] [DEBUG] Re-attached to fresh guest page: ${newGuestPage.url()}`);
                        // Ensure tools are set up on this fresh page (if not already done by targetcreated)
                        await setupPage(newGuestPage);
                    }
                }
            } else if (i === maxRetries - 1) {
                console.error("Navigation failed after all retries", e);
            }
        }
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
            if (page && !page.isClosed()) {
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
        reportManager
    };
}