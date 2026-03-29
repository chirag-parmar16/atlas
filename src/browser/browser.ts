import puppeteer, { Page, Browser, Target } from 'puppeteer-core';
import { NetworkRequest, Violation, ChaosConfig, ConsoleEntry, StorageMetrics } from '../engine/state';
import { launchElectron, killElectron } from '../electron/electron-launcher';
import { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// Engine (Brain)
import { createNetworkInterceptor, NetworkInterceptor } from '../engine/network-interceptor';
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


export async function launchBrowser(domain: string, localPort: number, projectPath: string, logger: (msg: string) => void = console.log, onBrowserClose?: () => void, disabledTabs: string[] = [], projectName: string = '', engineConfig: { strictMode?: boolean, basePath?: string, allowedRoutes?: string[], appUrl?: string } = {}): Promise<{
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

    const networkManagers: NetworkInterceptor[] = [];
    let page: Page | null = null;
    const activePages = new Set<Page>();
    const pageToTabId = new Map<Page, string>();
    // Track stable Puppeteer Target objects to prevent duplicate setup across renderer swaps
    const processedTargets = new Set<Target>();

    // ── Loading Screen ────────────────────────────────────────────────────────
    // Two delivery modes:
    //  1. evaluateOnNewDocument: runs before page scripts on future navigations
    //  2. page.evaluate(): injects immediately on current document (if DOM already ready)
    // Dismissed via page.on('load') in setupPage — fires after every page finish.
    const ATLAS_LOADING_SCREEN = `(function(){
        'use strict';
        if(window.__atlasLoadingInjected)return;
        window.__atlasLoadingInjected=true;
        
        // Default to not ready. Proxy will inject a script to set this to true on first project load.
        if(typeof window.__ATLAS_READY__ === 'undefined') window.__ATLAS_READY__ = false;

        var css=[
            '#__atlas_shield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;',
            'background:linear-gradient(135deg,#0d1117 0%,#161b22 100%);',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;',
            'transition:opacity 0.5s ease,transform 0.5s ease;}',
            '#__atlas_shield.--ready{opacity:0;transform:scale(1.04);pointer-events:none;}',
            '#__atlas_spinner{width:44px;height:44px;border:3px solid rgba(88,166,255,0.15);',
            'border-top-color:#58a6ff;border-radius:50%;animation:__atlasSpin 0.75s linear infinite;}',
            '@keyframes __atlasSpin{to{transform:rotate(360deg)}}',
            '#__atlas_badge{display:flex;align-items:center;gap:10px;}',
            '#__atlas_badge span{font-size:20px;font-weight:700;color:#f0f6fc;letter-spacing:-0.03em;}',
            '#__atlas_status{font-size:12px;color:#58a6ff;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;}',
            '#__atlas_sub{font-size:11px;color:#6e7681;margin-top:-10px;}'
        ].join('');

        var s=document.createElement('style');s.textContent=css;
        var shield=document.createElement('div');shield.id='__atlas_shield';
        shield.innerHTML=[
            '<div id="__atlas_spinner"></div>',
            '<div id="__atlas_badge">',
            '<svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">',
            '<circle cx="16" cy="16" r="14" stroke="#58a6ff" stroke-width="1.5" opacity="0.4"/>',
            '<polygon points="16,5 27,26 5,26" fill="#58a6ff" opacity="0.95"/>',
            '</svg>',
            '<span>Atlas</span>',
            '</div>',
            '<div id="__atlas_status">Securing connection\u2026</div>',
            '<div id="__atlas_sub">Taking control of the sandbox</div>'
        ].join('');

        var inject=function(){
            if(window.__ATLAS_READY__ || document.getElementById('__atlas_shield')) return;
            document.head.appendChild(s);
            (document.body||document.documentElement).appendChild(shield);
        };

        if(document.readyState==='loading'){
            document.addEventListener('DOMContentLoaded',inject,{once:true});
        } else {
            inject();
        }

        window.__atlasReady=function(){
            window.__ATLAS_READY__ = true;
            var el=document.getElementById('__atlas_shield');
            if(el){el.classList.add('--ready');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},600);}
        };
    })();`;

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
                reqHeaders: req.reqHeaders || {},
                resHeaders: req.resHeaders || {},
                body: req.body || '',
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
            // Reset network traffic in HUD on navigation (Default behavior: don't preserve log)
            await mainWindow.evaluate(() => {
                // @ts-ignore
                if (window.clearTraffic) window.clearTraffic();
            });
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
    }).catch(() => { });

    await mainWindow.exposeFunction('__atlasClearTraffic', () => {
        networkManagers.forEach(mgr => mgr.clearHistory());
        console.log('[Atlas] HUD requested traffic clear — Backend history wiped.');
    }).catch(() => { });

    console.log('[Atlas] Hub attached. Waiting for guest viewport...');

    // Wait for the webview target to be created by index.html
    const webviewTarget = await browser.waitForTarget((t: Target) => {
        const type = t.type();
        const url = t.url();

        // Target matching: prioritizes 'webview'. 
        // Also accepts 'page' if it's explicitly on the target domain.
        // We removed 'about:blank' and 'other' matching to prevent double-initialization bugs.
        const isWebview = type === 'webview';
        const isGuestPage = type === 'page' && url.includes(domain) && !url.includes('index.html');

        if (type !== 'background_page' && type !== 'browser') {
            const status = (isWebview || isGuestPage) ? 'MATCHED' : 'SKIPPED';
            console.log(`[Atlas] Scanning target: ${type} (${url || 'empty'}) -> ${status}`);
        }

        return isWebview || isGuestPage;
    }, { timeout: 15000 }).catch((err: Error) => {
        console.error('[Atlas] FATAL: Timeout waiting for Guest page. Is the HUD visible?');
        throw err;
    });

    page = await webviewTarget.page();

    if (!page) {
        // If it's a webview target but page() is null, we might need a retry or it's a fatal Electron issue
        console.error('[Atlas] Target found but page() is null. Type:', webviewTarget.type());
        throw new Error('[Atlas] Failed to attach to Guest page. Host UI may be broken.');
    }

    console.log(`[Atlas] Guest page attached (${webviewTarget.type()}).`);
    await page.setUserAgent(userAgentStr);

    // DEBUG: Bridge Console (Silenced for cleaner terminal)
    // page.on('console', msg => console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
    // page.on('pageerror', (err: Error) => console.error(`[Browser Error] ${err.toString()}`));

    // Generic Tool Injection
    const setupPage = async (targetPage: Page) => {
        if (activePages.has(targetPage)) return;
        activePages.add(targetPage);

        console.log(`[Atlas] [DEBUG] setupPage start for: ${targetPage.url()}`);

        // tabId is declared early and captured by reference in all callbacks below.
        // This means once it is resolved (async, below), all future callback invocations
        // will automatically use the real tabId — no rewiring needed.
        let tabId = '';

        // ─── PHASE 1: Attach network interceptor IMMEDIATELY ──────────────────────
        // CRITICAL: Must happen before any navigation, especially for target="_blank"
        // links. Waiting for tabId first creates a 2s gap where requests bypass Atlas
        // and hit the system proxy (Pixy Proxy → 406 error).
        await targetPage.setCacheEnabled(true);
        const netInterceptor = createNetworkInterceptor(targetPage, { 
            domain, 
            localPort,
            strictMode: engineConfig.strictMode,
            basePath: engineConfig.basePath,
            allowedRoutes: engineConfig.allowedRoutes,
            appUrl: engineConfig.appUrl
        }, {
            onViolation: (v: Violation) => pipeline.emit('violation', { ...v, tabId }),
            onNetworkEvent: (r: NetworkRequest) => pipeline.emit('network:request', { ...r, tabId }),
            onLog: logger,
            onNavigation: (url: string) => pipeline.emit('navigation', { url, timestamp: Date.now(), tabId })
        });
        console.log(`[Atlas] [DEBUG] Initializing netInterceptor...`);
        await netInterceptor.init();
        console.log(`[Atlas] [DEBUG] netInterceptor initialized.`);
        networkManagers.push(netInterceptor);

        // Inject loading screen for future navigations on this page
        try { await targetPage.evaluateOnNewDocument(ATLAS_LOADING_SCREEN); } catch (_) { }

        // ─── PHASE 2: Resolve tab ID (up to 2s, deferred) ────────────────────────
        // This is where "Full Control" is finalized. Once we have the tabId,
        // we can signal the ProxyEngine to release the holding pattern.
        try {
            for (let i = 0; i < 20; i++) {
                tabId = await targetPage.evaluate(() => (window as { __atlasTabId?: string }).__atlasTabId) || '';
                if (tabId) break;
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (e) { }

        if (tabId) {
            pageToTabId.set(targetPage, tabId);
            console.log(`[Atlas] [DEBUG] Mapped page ${targetPage.url()} to tabId: ${tabId}. Signaling Proxy initialization.`);
        } else {
            console.log(`[Atlas] [DEBUG] tabId resolution timed out for ${targetPage.url()}. Signaling Proxy regardless to prevent lockup.`);
        }

        // ─── PHASE 3: Final Injection ─────────────────────────────────────────
        // NOTE: setInitialized() is NOT called here.
        // It will be called by the caller AFTER the first page.goto() to the
        // masked domain completes — that is the true "Full Control" moment.

        // Inject loading screen on current document (covers page already in the webview)
        try { await targetPage.evaluate(ATLAS_LOADING_SCREEN); } catch (_) { }

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
                message = msg.text() || ''; // Fallback to simple text
            }

            message = message.trim();
            if (!message) return; // Skip empty logs to prevent "Ghost [ERROR]" noise

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

        // 6. Browser Bridge Functions (Telemetry Only)
        // Audit Fix: Remove sensitive control functions from Guest Page.
        // Controls (Close, Minimize, etc.) are now handled by the Electron Host UI (atlasControls).
        const bridgeFunctions: Record<string, Function> = {
            // Keep only what is needed for SPA tracking or guest-side logging
            setSecurityMode: async (mode: string) => {
                console.warn(`[Atlas Security] Guest page attempted to change security mode to: ${mode}. Action blocked.`);
            },
            setStressConfig: async () => {
                console.warn(`[Atlas Security] Guest page attempted to change stress config. Action blocked.`);
            },
            atlasGetTabId: async () => tabId
        };

        console.log(`[Atlas] [DEBUG] Exposing bridge functions to guest...`);
        for (const [name, fn] of Object.entries(bridgeFunctions)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await targetPage.exposeFunction(name, fn as any);
            } catch (e) {
                // Function already exposed - safe to ignore on navigations
            }
        }
        console.log(`[Atlas] [DEBUG] setupPage complete for: ${targetPage.url()}`);
        return netInterceptor;
    };

    // 4. Attach Modules (Initial Page) — keep a handle to signal readiness after goto
    const mainInterceptor = page ? await setupPage(page) : null;

    // 3. Navigation Lock & Multi-Tab Support
    browser.on('targetcreated', async (target: Target) => {
        const targetUrl = target.url();
        const type = target.type();

        // Always skip the Atlas HUD window itself
        if (targetUrl.includes('index.html')) return;

        const isNewTab = type === 'page';
        const isUsefulWebview = (type === 'webview' || type === 'other') && targetUrl !== 'about:blank';
        if (!isNewTab && !isUsefulWebview) return;

        // Stable deduplication by Target object reference.
        // Puppeteer reuses the same Target instance for the same browser tab.
        if (processedTargets.has(target)) return;
        processedTargets.add(target);

        const newPage = await target.page().catch(() => null);
        if (!newPage) return;

        if (isNewTab && (targetUrl === 'about:blank' || targetUrl === '')) {
            // ── Blank new tab (target="_blank" link clicked) ──────────────────
            // CRITICAL: Do NOT call any Page methods here (url, evaluate, setCacheEnabled)
            // Chromium hasn't created the main frame yet → "Requesting main frame too early!"
            //
            // Strategy:
            //  1. Pre-inject loading screen script (safe CDP-level call, no frame needed)
            //  2. Listen for framenavigated — fires at start of real navigation, before any resource
            //  3. THEN do full setupPage (network interceptor, tabId, etc.)
            try {
                await newPage.evaluateOnNewDocument(ATLAS_LOADING_SCREEN);
            } catch (_) { /* non-fatal if page isn't ready for CDP scripts yet */ }

            newPage.once('framenavigated', async (frame) => {
                if (newPage.isClosed()) return;
                try {
                    // Only handle the main frame's first real navigation
                    if (frame !== newPage.mainFrame()) return;
                    const navUrl = frame.url();
                    if (!navUrl || navUrl === 'about:blank') return;

                    console.log(`[Atlas] _blank tab navigated to: ${navUrl} — setting up proxy`);
                    await newPage.setUserAgent(userAgentStr);
                    await setupPage(newPage);
                    page = newPage;
                } catch (e) {
                    console.error('[Atlas] Error setting up _blank tab after navigation:', (e as Error).message);
                }
            });
            return;
        }

        // ── Webview / non-blank page: setup immediately ───────────────────────
        try {
            await newPage.setUserAgent(userAgentStr);
            await setupPage(newPage);
            page = newPage;
        } catch (e) {
            console.error('[Atlas] Error setting up new target page:', (e as Error).message);
        }
    });

    browser.on('targetdestroyed', (target: Target) => {
        processedTargets.delete(target);
        // Clean up any stale closed pages from activePages
        for (const p of activePages) {
            try { if (p.isClosed()) { activePages.delete(p); pageToTabId.delete(p); } } catch (_) { }
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

            // ── FULL CONTROL ACHIEVED ─────────────────────────────────────────────
            // The goto to the masked domain has succeeded. Atlas now owns the page.
            // Signal the ProxyEngine to release its gate and dismiss the loading screen.
            if (i === 0 && mainInterceptor) {
                mainInterceptor.setInitialized();
            }

            // Navigation is logged automatically by the network interceptor's
            // handleRequest() → pipeline.emit('navigation') → reportManager.logNavigation().
            // Do NOT call logNavigation() again here — it would create a duplicate entry.
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