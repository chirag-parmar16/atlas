(function () {
    let containerEl = null;

    const ICONS = {
        META: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
        SCRIPT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>',
        STYLE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>',
        COOKIE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>'
    };

    const renderApplication = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const metaTags = Array.from(document.querySelectorAll('meta'));
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const cookies = document.cookie.split(';').filter(c => c.trim().length > 0);

        const createSection = (title, items, icon, color) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:16px; background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);';
            section.innerHTML = '<div style="font-weight:800; color:#fff; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' + 
                '<span style="display:flex; align-items:center; gap:8px; color:' + color + ';">' + icon + ' <span style="color:#fff">' + title + '</span></span>' +
                '<span style="background:' + color + '22; color:' + color + '; padding:2px 8px; border-radius:10px; font-size:11px; border:1px solid ' + color + '44;">' + items.length + '</span></div>';
            
            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:4px; max-height:150px; overflow-y:auto;';
            
            if (items.length === 0) {
                list.innerHTML = '<div style="color:#52525b; font-size:11px; font-style:italic; padding-left:4px;">None found.</div>';
            }

            items.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'font-size:11px; color:#a1a1aa; font-family:"JetBrains Mono", monospace; word-break:break-all; padding:3px 4px; border-bottom:1px solid rgba(255,255,255,0.02);';
                if (typeof item === 'string') row.textContent = item;
                else if (item.src) row.textContent = item.src.split('/').pop();
                else if (item.href) row.textContent = item.href.split('/').pop();
                else if (item.name || item.property) row.textContent = (item.name || item.property) + ': ' + item.content;
                list.appendChild(row);
            });
            section.appendChild(list);
            containerEl.appendChild(section);
        };

        createSection('Meta Tags', metaTags, ICONS.META, '#3b82f6');
        createSection('Scripts', scripts, ICONS.SCRIPT, '#f59e0b');
        createSection('Stylesheets', styles, ICONS.STYLE, '#10b981');
        createSection('Cookies', cookies, ICONS.COOKIE, '#a78bfa');
    };

    window.Atlas.addTool('Application', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderApplication();
        return containerEl;
    }, renderApplication);
})();
export {};
