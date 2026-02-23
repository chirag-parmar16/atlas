/**
 * Atlas Collectors (Nervous)
 * 
 * Formalized data-gathering scripts. Each collector is a string
 * template injected into the user's page via Puppeteer.
 * 
 * These were previously embedded inline in browser.ts.
 * Now organized here for clarity and reuse.
 */

/**
 * NAVIGATION_HOOKS
 * 
 * Catches SPA transitions: pushState, replaceState, popstate, hashchange.
 * Calls window.atlasLogNavigation() which is exposed by the Transport layer.
 */
export const NAVIGATION_HOOKS: string = `
(function() {
    var log = function() {
        if (window.atlasLogNavigation) window.atlasLogNavigation(window.location.href);
    };
    window.addEventListener('hashchange', log);
    window.addEventListener('popstate', log);

    var origPush = history.pushState;
    history.pushState = function(data: any, unused: string, url?: string | URL | null) {
        origPush.apply(this, [data, unused, url]);
        log();
    };

    var origReplace = history.replaceState;
    history.replaceState = function(data: any, unused: string, url?: string | URL | null) {
        origReplace.apply(this, [data, unused, url]);
        log();
    };
})();
`;

/**
 * STORAGE_COLLECTOR
 * 
 * On-demand function exposed as window.__atlas_collectStorage().
 * Returns storage sizes, resource breakdown, and page weight.
 */
export const STORAGE_COLLECTOR: string = `
(function() {
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
})();
`;

/**
 * PAGE_INFO_COLLECTOR
 * 
 * On-demand function exposed as window.__atlas_collectPageInfo().
 * Returns page metadata: title, meta tags, scripts, styles, cookies, storage.
 */
export const PAGE_INFO_COLLECTOR: string = `
(function() {
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
})();
`;
