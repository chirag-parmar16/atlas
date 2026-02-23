/**
 * Atlas Transport — Injector
 * 
 * Handles Shadow DOM injection and collectors.
 */

import { Page } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

export function buildInjectorScript(wsPort: number): string {
    const rendererDir = path.join(__dirname, '..', '..', '..', 'src', 'renderer');
    let cssContent = '';
    let appContent = '';
    try {
        cssContent = fs.readFileSync(path.join(rendererDir, 'styles.css'), 'utf-8');
        appContent = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf-8');
    } catch (e) { }

    return `
(function() {
    if (window.__ATLAS_INJECTED__) return;
    window.__ATLAS_INJECTED__ = true;
    document.documentElement.style.marginTop = '36px';
    document.documentElement.style.height = 'calc(100% - 36px)';
    var host = document.createElement('div');
    host.id = 'atlas-root';
    host.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; z-index:2147483647; pointer-events:none;';
    var shadow = host.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = \${JSON.stringify(cssContent)};
    shadow.appendChild(style);
    var appDiv = document.createElement('div');
    appDiv.id = 'atlas-app';
    appDiv.style.cssText = 'pointer-events:none; width:100%; height:100%;';
    shadow.appendChild(appDiv);
    var mount = function() {
        if (document.body) document.body.appendChild(host);
        else document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(host); });
    };
    mount();
    var observer = new MutationObserver(function() {
        if (!document.getElementById('atlas-root') && !host.parentNode) {
            mount();
            document.documentElement.style.marginTop = '36px';
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__atlas_shadow__ = shadow;
    window.__atlas_app_root__ = appDiv;
    window.__atlas_ws_port__ = \${wsPort};
    try { \${appContent} } catch(e) {}
    window.__atlas_report = function(type, data) {
        try { if (window.__atlas_onCollectorData) window.__atlas_onCollectorData(JSON.stringify({ type: type, data: data })); } catch(e) {}
    };
    (function() {
        var origPush = history.pushState;
        history.pushState = function(data, unused, url) { 
            origPush.apply(this, [data, unused, url]); 
            if (window.atlasLogNavigation) window.atlasLogNavigation(window.location.href);
        };
        var origReplace = history.replaceState;
        history.replaceState = function(data, unused, url) { 
            origReplace.apply(this, [data, unused, url]); 
            if (window.atlasLogNavigation) window.atlasLogNavigation(window.location.href);
        };
    })();
})();
`;
}

export async function injectAtlas(
    page: Page,
    wsPort: number,
    onCollectorData: (raw: string) => void
): Promise<void> {
    const script = buildInjectorScript(wsPort);
    try { await page.exposeFunction('__atlas_onCollectorData', (raw: string) => { onCollectorData(raw); }); } catch (e) { }
    await page.evaluateOnNewDocument(script);
    await page.evaluate(script);
}
