(function () {
    interface LogEntry {
        level: string;
        message: string;
        timestamp: number;
        stack: string;
    }

    const logs: LogEntry[] = [];
    let activeFilter: string = 'all';
    let listEl: HTMLElement | null = null;
    let renderTimeout: any = null;
    const countEls: Record<string, HTMLElement> = {};

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const LEVEL_CONFIG: Record<string, { color: string, bg: string, icon: string, label: string, badge: string }> = {
        log: { color: '#ffffff', bg: 'rgba(255,255,255,0.02)', icon: '●', label: 'LOG', badge: '#71717a' },
        warn: { color: '#facc15', bg: 'rgba(250,204,21,0.06)', icon: '▲', label: 'WRN', badge: '#facc15' },
        error: { color: '#ff4d4d', bg: 'rgba(239,68,68,0.12)', icon: '✕', label: 'ERR', badge: '#ef4444' },
        info: { color: '#60a5fa', bg: 'rgba(59,130,246,0.06)', icon: 'ℹ', label: 'INF', badge: '#60a5fa' },
        debug: { color: '#a78bfa', bg: 'rgba(167,139,250,0.04)', icon: '◦', label: 'DBG', badge: '#a78bfa' }
    };

    const atlas = (window as any).Atlas;

    const throttledRender = () => {
        if (renderTimeout) return;
        renderTimeout = requestAnimationFrame(() => {
            renderLogs();
            renderTimeout = null;
        });
    };

    atlas.on('consoleLog', (entry: any) => {
        const level = entry.level || 'log';
        const msg = entry.message || '';
        if (msg.includes('[Atlas]') || msg.includes('%c[Atlas]')) return;

        logs.push({
            level,
            message: msg,
            timestamp: entry.timestamp || Date.now(),
            stack: level === 'error' ? (entry.stack || '') : ''
        });

        if (logs.length > 500) logs.shift();
        throttledRender();
    });

    const renderLogs = () => {
        if (!listEl) return;

        const filtered = activeFilter === 'all' ? logs : logs.filter(l => l.level === activeFilter);
        const counts: Record<string, number> = { all: logs.length, log: 0, warn: 0, error: 0, info: 0, debug: 0 };
        logs.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++; });
        Object.keys(countEls).forEach(k => { if (countEls[k]) countEls[k].innerText = String(counts[k] || 0); });

        // Efficient clear
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

        const displayLogs = filtered.slice(-150); // Limit to 150 items for perf

        if (displayLogs.length === 0) {
            listEl.innerHTML = '<div style="color:#3f3f46; text-align:center; padding-top:40px; font-style:italic; font-size:11px;">No logs recorded.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        displayLogs.forEach(entry => {
            const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.log;
            const item = document.createElement('div');
            item.style.cssText = `padding:8px 12px; background:${cfg.bg}; border-left:3px solid ${cfg.badge}; border-radius:4px; font-size:11px; line-height:1.4; margin-bottom:2px;`;

            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:2px;';
            header.innerHTML = `<span style="color:${cfg.badge}; font-weight:800; font-size:9px;">${cfg.icon} ${cfg.label}</span>` +
                `<span style="color:#52525b; font-size:9px; margin-left:auto;">${time}</span>`;
            item.appendChild(header);

            const content = document.createElement('div');
            content.style.cssText = `color:${cfg.color}; word-break:break-all; white-space:pre-wrap; opacity: 0.9;`;
            content.textContent = entry.message;
            item.appendChild(content);

            if (entry.stack && entry.level === 'error') {
                const stackEl = document.createElement('pre');
                stackEl.style.cssText = 'display:none; margin-top:8px; padding:8px; background:rgba(0,0,0,0.3); color:#ff4d4d; font-size:9px; overflow-x:auto; border:1px solid rgba(255,255,255,0.05); border-radius:4px;';
                stackEl.textContent = entry.stack;
                item.appendChild(stackEl);
                item.style.cursor = 'pointer';
                item.onclick = () => {
                    const isVisible = stackEl.style.display === 'block';
                    stackEl.style.display = isVisible ? 'none' : 'block';
                };
            }
            fragment.appendChild(item);
        });

        listEl.appendChild(fragment);
        listEl.scrollTop = listEl.scrollHeight;
    };

    atlas.addTool('Console', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';

        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'display:flex; gap:4px; padding:10px 12px; background:rgba(20, 20, 20, 0.4); border-bottom:1px solid rgba(255,255,255,0.05);';

        ['all', 'error', 'warn', 'info', 'log'].forEach(key => {
            const btn = document.createElement('button');
            const active = activeFilter === key;
            btn.style.cssText = `background:${active ? 'rgba(255,255,255,0.08)' : 'transparent'}; color:${active ? '#fff' : '#52525b'}; padding:4px 8px; border-radius:4px; font-size:9px; cursor:pointer; border:none; font-weight:800; text-transform:uppercase;`;
            btn.innerText = key;
            const countSpan = document.createElement('span');
            countSpan.style.opacity = '0.5';
            countSpan.style.marginLeft = '4px';
            countSpan.innerText = '0';
            countEls[key] = countSpan;
            btn.appendChild(countSpan);
            btn.onclick = () => {
                activeFilter = key;
                filterBar.querySelectorAll('button').forEach(b => {
                    (b as HTMLElement).style.background = 'transparent';
                    (b as HTMLElement).style.color = '#52525b';
                });
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = '#fff';
                renderLogs();
            };
            filterBar.appendChild(btn);
        });

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'margin-left:auto; color:#ef4444; font-size:10px; cursor:pointer; background:transparent; border:none; display:flex; align-items:center; gap:4px; font-weight:800; text-transform:uppercase;';
        clearBtn.innerHTML = ICONS.TRASH + ' Clear';
        clearBtn.onclick = () => { logs.length = 0; renderLogs(); };
        filterBar.appendChild(clearBtn);

        container.appendChild(filterBar);
        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px; padding:10px; background:transparent;';
        container.appendChild(listEl);
        renderLogs();
        return container;
    }, renderLogs);
})();
export { };
