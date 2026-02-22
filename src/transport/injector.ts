/**
 * Atlas Transport — Injector
 * 
 * Injects into the user's page:
 * 1. Shadow DOM with full UI (HUD + Pill + Menu + Tabs) — pushes content down
 * 2. Collector scripts (console, storage, page-info)
 * 3. Navigation hooks (pushState, popstate, hashchange)
 * 4. Bridge functions for Collectors → Engine communication
 * 
 * Uses Shadow DOM instead of iframe for:
 * - Pointer events work naturally (no iframe barrier)
 * - HUD can push page content down (margin-top on body)
 * - Style isolation (Shadow DOM encapsulates CSS)
 * - Same premium look as the old injection
 */

import { Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

/**
 * Build the injector script that will be evaluated in the user's page.
 * Includes: full UI (HUD, pill, menu, tabs), collectors, nav hooks.
 */
export function buildInjectorScript(wsPort: number): string {

    // Read CSS and app.js from source
    const rendererDir = path.join(__dirname, '..', '..', '..', 'src', 'renderer');
    let cssContent = '';
    let appContent = '';
    try {
        cssContent = fs.readFileSync(path.join(rendererDir, 'styles.css'), 'utf-8');
        appContent = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf-8');
    } catch (e) {
        console.error('[Atlas] Failed to read renderer files:', e);
    }

    return `
(function() {
    // Guard: prevent double injection
    if (window.__ATLAS_INJECTED__) return;
    window.__ATLAS_INJECTED__ = true;

    // === 1. PUSH PAGE CONTENT DOWN (HUD space) ===
    document.documentElement.style.marginTop = '36px';
    document.documentElement.style.height = 'calc(100% - 36px)';

    // === 2. SHADOW DOM HOST ===
    var host = document.createElement('div');
    host.id = 'atlas-root';
    host.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; z-index:2147483647; pointer-events:none;';
    
    var shadow = host.attachShadow({ mode: 'closed' });
    
    // Inject CSS
    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(cssContent)};
    shadow.appendChild(style);
    
    // App container
    var appDiv = document.createElement('div');
    appDiv.id = 'atlas-app';
    appDiv.style.cssText = 'pointer-events:none; width:100%; height:100%;';
    shadow.appendChild(appDiv);
    
    // Mount
    var mount = function() {
        if (document.body) {
            document.body.appendChild(host);
        } else {
            document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(host); });
        }
    };
    mount();
    
    // Re-mount protection (SPA DOM wipe = Immortal UI)
    var observer = new MutationObserver(function() {
        if (!document.getElementById('atlas-root') && !host.parentNode) {
            mount();
            // Re-apply margin
            document.documentElement.style.marginTop = '36px';
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    
    // === 3. BOOT APP (inject into Shadow DOM context) ===
    // We need to pass the shadow root to the app
    window.__atlas_shadow__ = shadow;
    window.__atlas_app_root__ = appDiv;
    window.__atlas_ws_port__ = ${wsPort};
    
    // Run app.js in page context (it reads __atlas_shadow__ and __atlas_app_root__)
    try {
        ${appContent}
    } catch(e) {
        console.error('[Atlas] App boot error:', e);
    }
    
    // === 4. COLLECTOR BRIDGE ===
    window.__atlas_report = function(type, data) {
        try {
            if (window.__atlas_onCollectorData) {
                window.__atlas_onCollectorData(JSON.stringify({ type: type, data: data }));
            }
        } catch(e) {}
    };
    
    // === 5. CONSOLE COLLECTOR ===
    (function() {
        var origLog = console.log;
        var origWarn = console.warn;
        var origError = console.error;
        var origInfo = console.info;
        var origDebug = console.debug;
        
        var PII_PATTERNS = {
            CreditCard: /\\b(?:\\d[ -]*?){13,16}\\b/g,
            AuthToken: /\\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16})\\b/gi,
            Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g
        };
        
        var intercept = function(level, origFn) {
            console[level] = function() {
                origFn.apply(console, arguments);
                var args = Array.prototype.slice.call(arguments);
                var msg = args.map(function(a) {
                    if (typeof a === 'object') { try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); } }
                    return String(a);
                }).join(' ');
                if (msg.indexOf('[Atlas]') !== -1) return;
                var stack = '';
                if (level === 'error') {
                    try { var err = new Error(); stack = (err.stack || '').split('\\n').slice(2, 8).join('\\n'); } catch(e) {}
                }
                var piiLeaks = [];
                Object.keys(PII_PATTERNS).forEach(function(type) {
                    var matches = msg.match(PII_PATTERNS[type]);
                    if (matches && matches.length > 0) piiLeaks.push({ type: type, matches: matches.slice(0, 5) });
                });
                window.__atlas_report('console', { level: level, message: msg, timestamp: Date.now(), stack: stack, piiLeaks: piiLeaks.length > 0 ? piiLeaks : undefined });
            };
        };
        intercept('log', origLog);
        intercept('warn', origWarn);
        intercept('error', origError);
        intercept('info', origInfo);
        intercept('debug', origDebug);
        
        window.addEventListener('error', function(e) {
            window.__atlas_report('console', { level: 'error', message: e.message || 'Uncaught Error', timestamp: Date.now(), stack: (e.error && e.error.stack) || '', source: e.filename, line: e.lineno });
        });
        window.addEventListener('unhandledrejection', function(e) {
            window.__atlas_report('console', { level: 'error', message: e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection', timestamp: Date.now(), stack: (e.reason && e.reason.stack) || '' });
        });
    })();
    
    // === 6. STORAGE COLLECTOR (on-demand) ===
    window.__atlas_collectStorage = function() {
        try {
            var lsSize = 0, ssSize = 0, cookieSize = document.cookie.length;
            try { Object.keys(localStorage).forEach(function(k) { lsSize += k.length + localStorage[k].length; }); } catch(e){}
            try { Object.keys(sessionStorage).forEach(function(k) { ssSize += k.length + sessionStorage[k].length; }); } catch(e){}
            var resources = [], breakdown = { images: 0, scripts: 0, styles: 0, fonts: 0, other: 0 }, totalTransfer = 0;
            try {
                performance.getEntriesByType('resource').forEach(function(e) {
                    var size = e.transferSize || e.encodedBodySize || 0;
                    totalTransfer += size;
                    resources.push({ name: e.name, size: size, type: e.initiatorType, duration: Math.round(e.duration) });
                    if (e.initiatorType === 'img') breakdown.images += size;
                    else if (e.initiatorType === 'script') breakdown.scripts += size;
                    else if (e.initiatorType === 'css' || e.initiatorType === 'link') breakdown.styles += size;
                    else breakdown.other += size;
                });
            } catch(e) {}
            return { domSize: document.documentElement.outerHTML.length, localStorageSize: lsSize, sessionStorageSize: ssSize, cookieSize: cookieSize, totalTransfer: totalTransfer, resources: resources.sort(function(a,b){return b.size-a.size;}).slice(0,10), breakdown: breakdown };
        } catch(e) { return null; }
    };
    
    // === 7. PAGE INFO COLLECTOR (on-demand) ===
    window.__atlas_collectPageInfo = function() {
        try {
            var metas = []; document.querySelectorAll('meta').forEach(function(m) { metas.push({ name: m.getAttribute('name') || m.getAttribute('property') || '', content: m.getAttribute('content') || '' }); });
            var scripts = { external: 0, inline: 0, urls: [] }; document.querySelectorAll('script').forEach(function(s) { if (s.src) { scripts.external++; scripts.urls.push(s.src); } else scripts.inline++; });
            var styles = { external: 0, inline: 0, urls: [] }; document.querySelectorAll('link[rel=stylesheet]').forEach(function(l) { if (l.href) { styles.external++; styles.urls.push(l.href); } }); document.querySelectorAll('style').forEach(function() { styles.inline++; });
            var cookies = document.cookie.split(';').filter(function(c){return c.trim();}).map(function(c) { var p = c.split('='); return { name: (p[0]||'').trim(), value: (p.slice(1).join('=')||'').trim() }; });
            var lsItems = [], ssItems = [];
            try { Object.keys(localStorage).forEach(function(k) { lsItems.push({ key: k, value: (localStorage[k]||'').substring(0,100) }); }); } catch(e){}
            try { Object.keys(sessionStorage).forEach(function(k) { ssItems.push({ key: k, value: (sessionStorage[k]||'').substring(0,100) }); }); } catch(e){}
            return { title: document.title, url: window.location.href, charset: document.characterSet, doctype: document.doctype ? document.doctype.name : 'none', readyState: document.readyState, contentType: document.contentType || 'text/html', metaTags: metas, scripts: scripts, stylesheets: styles, cookies: cookies, localStorage: lsItems, sessionStorage: ssItems };
        } catch(e) { return null; }
    };
    
    // === 8. NAVIGATION HOOKS ===
    var navLog = function() { if (window.atlasLogNavigation) window.atlasLogNavigation(window.location.href); };
    window.addEventListener('hashchange', navLog);
    window.addEventListener('popstate', navLog);
    var origPush = history.pushState;
    history.pushState = function() { origPush.apply(this, arguments); navLog(); };
    var origReplace = history.replaceState;
    history.replaceState = function() { origReplace.apply(this, arguments); navLog(); };
    
    console.log('%c[Atlas] Runtime v2.0 injected', 'color:cyan; font-weight:bold');
})();
`;
}

/**
 * Inject the Atlas runtime into a Puppeteer page.
 */
export async function injectAtlas(
    page: Page,
    wsPort: number,
    onCollectorData: (raw: string) => void
): Promise<void> {
    const script = buildInjectorScript(wsPort);

    // Expose bridge function for Collectors → Engine
    try {
        await page.exposeFunction('__atlas_onCollectorData', (raw: string) => {
            onCollectorData(raw);
        });
    } catch (e) { /* Already exposed */ }

    // Persist across navigations
    await page.evaluateOnNewDocument(script);

    // Inject immediately into current context
    await page.evaluate(script);
}
