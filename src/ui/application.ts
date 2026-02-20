
export const APPLICATION = `
// application.js
(function () {
    let containerEl = null;

    const ICONS = {
        PAGE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
        TAG: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
        CODE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
        PALETTE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>',
        COOKIE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 15.5v.01"></path><path d="M12 12v.01"></path><path d="M11 17v.01"></path><path d="M7 14v.01"></path></svg>',
        DATABASE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
        CLIPBOARD: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>'
    };

    const renderApp = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const createSection = (title, icon) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:14px;';
            const header = document.createElement('div');
            header.style.cssText = 'font-weight:700; color:#fff; font-size:13px; border-bottom:1px solid #27272a; padding-bottom:6px; margin-bottom:10px; display:flex; align-items:center; gap:8px;';
            header.innerHTML = '<span style="color:#10b981; display:flex;">' + icon + '</span> ' + title;
            section.appendChild(header);
            return section;
        };

        const createRow = (label, value, color) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; padding:4px 0; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.03);';
            row.innerHTML = '<span style="color:#a1a1aa; font-weight:500;">' + label + '</span><span style="color:' + (color || '#e4e4e7') + '; font-family:\\'JetBrains Mono\\',monospace; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right;" title="' + String(value).replace(/"/g, '&quot;') + '">' + value + '</span>';
            return row;
        };

        // 1. Page Info
        const pageSection = createSection('Page Info', ICONS.PAGE);
        pageSection.appendChild(createRow('Title', document.title || '(none)'));
        pageSection.appendChild(createRow('URL', window.location.href));
        pageSection.appendChild(createRow('Charset', document.characterSet || 'unknown'));
        pageSection.appendChild(createRow('DOCTYPE', document.doctype ? document.doctype.name : '(none)'));
        pageSection.appendChild(createRow('Ready State', document.readyState));
        const contentTypeMeta = document.querySelector('meta[http-equiv="Content-Type"]');
        pageSection.appendChild(createRow('Content-Type', contentTypeMeta ? contentTypeMeta.content : 'text/html'));
        containerEl.appendChild(pageSection);

        // 2. Meta Tags
        const metaSection = createSection('Meta Tags', ICONS.TAG);
        const metaTags = Array.from(document.querySelectorAll('meta'));
        if (metaTags.length === 0) {
            metaSection.innerHTML += '<div style="color:#52525b; font-size:12px; font-style:italic;">No meta tags found.</div>';
        } else {
            const metaList = document.createElement('div');
            metaList.style.cssText = 'max-height:160px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px;';
            metaTags.forEach(m => {
                const name = m.name || m.httpEquiv || m.getAttribute('property') || m.getAttribute('charset') || '—';
                const content = m.content || m.getAttribute('charset') || '—';
                metaList.appendChild(createRow(name, content, '#3b82f6'));
            });
            metaSection.appendChild(metaList);
        }
        containerEl.appendChild(metaSection);

        // 3. External Scripts
        const scriptSection = createSection('Scripts', ICONS.CODE);
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
        scriptSection.appendChild(createRow('External', scripts.length, '#10b981'));
        scriptSection.appendChild(createRow('Inline', inlineScripts.length, '#f59e0b'));
        if (scripts.length > 0) {
            const scriptList = document.createElement('div');
            scriptList.style.cssText = 'max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px; margin-top:6px;';
            scripts.forEach(s => {
                const row = document.createElement('div');
                row.style.cssText = 'font-size:11px; color:#a1a1aa; font-family:\\'JetBrains Mono\\',monospace; padding:3px 0; word-break:break-all;';
                row.textContent = s.src;
                scriptList.appendChild(row);
            });
            scriptSection.appendChild(scriptList);
        }
        containerEl.appendChild(scriptSection);

        // 4. Stylesheets
        const styleSection = createSection('Stylesheets', ICONS.PALETTE);
        const extStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const inlineStyles = Array.from(document.querySelectorAll('style'));
        styleSection.appendChild(createRow('External', extStyles.length, '#10b981'));
        styleSection.appendChild(createRow('Inline', inlineStyles.length, '#f59e0b'));
        if (extStyles.length > 0) {
            const styleList = document.createElement('div');
            styleList.style.cssText = 'max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px; margin-top:6px;';
            extStyles.forEach(s => {
                const row = document.createElement('div');
                row.style.cssText = 'font-size:11px; color:#a1a1aa; font-family:\\'JetBrains Mono\\',monospace; padding:3px 0; word-break:break-all;';
                row.textContent = s.href;
                styleList.appendChild(row);
            });
            styleSection.appendChild(styleList);
        }
        containerEl.appendChild(styleSection);

        // 5. Cookies
        const cookieSection = createSection('Cookies', ICONS.COOKIE);
        const cookies = document.cookie ? document.cookie.split(';').map(c => c.trim()) : [];
        cookieSection.appendChild(createRow('Total', cookies.length, '#f59e0b'));
        if (cookies.length > 0 && cookies[0] !== '') {
            const cookieList = document.createElement('div');
            cookieList.style.cssText = 'max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px; margin-top:6px;';
            cookies.forEach(c => {
                const parts = c.split('=');
                cookieList.appendChild(createRow(parts[0], parts.slice(1).join('=') || '(empty)', '#facc15'));
            });
            cookieSection.appendChild(cookieList);
        }
        containerEl.appendChild(cookieSection);

        // 6. LocalStorage
        const lsSection = createSection('LocalStorage', ICONS.DATABASE);
        const lsKeys = Object.keys(localStorage);
        lsSection.appendChild(createRow('Keys', lsKeys.length, '#10b981'));
        if (lsKeys.length > 0) {
            const lsList = document.createElement('div');
            lsList.style.cssText = 'max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px; margin-top:6px;';
            lsKeys.forEach(k => {
                const val = localStorage.getItem(k) || '';
                const truncated = val.length > 60 ? val.substring(0, 57) + '...' : val;
                lsList.appendChild(createRow(k, truncated, '#a855f7'));
            });
            lsSection.appendChild(lsList);
        }
        containerEl.appendChild(lsSection);

        // 7. SessionStorage
        const ssSection = createSection('SessionStorage', ICONS.CLIPBOARD);
        const ssKeys = Object.keys(sessionStorage).filter(k => !k.startsWith('atlas-'));
        ssSection.appendChild(createRow('Keys', ssKeys.length, '#10b981'));
        if (ssKeys.length > 0) {
            const ssList = document.createElement('div');
            ssList.style.cssText = 'max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:5px; padding:8px; margin-top:6px;';
            ssKeys.forEach(k => {
                const val = sessionStorage.getItem(k) || '';
                const truncated = val.length > 60 ? val.substring(0, 57) + '...' : val;
                ssList.appendChild(createRow(k, truncated, '#a855f7'));
            });
            ssSection.appendChild(ssList);
        }
        containerEl.appendChild(ssSection);
    };

    window.Atlas.addTool('Application', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:10px; color:#ccc; display:flex; flex-direction:column; gap:0; height:100%; overflow-y:auto;';
        renderApp();
        return containerEl;
    }, function () {
        renderApp();
    });
})();
`;
