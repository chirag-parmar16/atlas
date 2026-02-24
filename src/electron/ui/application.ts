(function () {
    let containerEl: HTMLElement | null = null;

    const ICONS = {
        META: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
        SCRIPT: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>',
        STYLE: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>',
        COOKIE: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>'
    };

    const renderApplication = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const metaTags = Array.from(document.querySelectorAll('meta'));
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const cookies = document.cookie.split(';').filter(c => c.trim().length > 0);

        const createSection = (title: string, items: any[], icon: string, color: string) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:12px; background:rgba(0,0,0,0.2); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); transition: border-color 0.2s;';
            section.onmouseover = () => section.style.borderColor = 'rgba(255,255,255,0.1)';
            section.onmouseout = () => section.style.borderColor = 'rgba(255,255,255,0.06)';

            const header = document.createElement('div');
            header.style.cssText = 'font-weight:800; color:#fff; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; text-transform:uppercase; letter-spacing:0.05em;';
            header.innerHTML = `<span style="display:flex; align-items:center; gap:10px; color:${color}; font-weight:900;">${icon} <span style="color:#fff">${title}</span></span>` +
                `<span style="background:${color}22; color:${color}; padding:2px 10px; border-radius:12px; font-size:10px; border:1px solid ${color}44; font-weight:900;">${items.length}</span>`;
            section.appendChild(header);

            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

            if (items.length === 0) {
                list.innerHTML = `<div style="color:#52525b; font-size:11px; font-style:italic; padding:10px; text-align:center; font-family:'Inter', sans-serif;">None found in current context.</div>`;
            }

            items.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'font-size:11px; color:#a1a1aa; font-family:"JetBrains Mono", monospace; word-break:break-all; padding:5px 4px; border-bottom:1px solid rgba(255,255,255,0.03); opacity:0.9; cursor:default;';
                row.onmouseover = () => row.style.color = '#fff';
                row.onmouseout = () => row.style.color = '#a1a1aa';

                if (typeof item === 'string') row.textContent = item;
                else if (item.src) row.textContent = item.src.split('/').pop() || item.src;
                else if (item.href) row.textContent = item.href.split('/').pop() || item.href;
                else if (item.name || item.property) row.textContent = (item.name || item.property) + ': ' + item.content;
                list.appendChild(row);
            });
            section.appendChild(list);
            containerEl!.appendChild(section);
        };

        createSection('Meta Tags', metaTags, ICONS.META, '#3b82f6');
        createSection('Script Nodes', scripts, ICONS.SCRIPT, '#f59e0b');
        createSection('Link Styles', styles, ICONS.STYLE, '#10b981');
        createSection('App Cookies', cookies, ICONS.COOKIE, '#a78bfa');
    };

    (window as any).Atlas.addTool('Application', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderApplication();
        return containerEl;
    }, renderApplication);
})();
export { };
