(function () {
    interface LogEntry {
        id: string;
        level: string;
        message: string;
        timestamp: number;
        stack: string;
        expanded?: boolean;
    }

    const logs: LogEntry[] = [];
    let activeFilter: string = 'all';
    let listEl: HTMLElement | null = null;
    let renderTimeout: any = null;
    let expandedLogId: string | null = null;
    const countEls: Record<string, HTMLElement> = {};

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const LEVEL_CONFIG: Record<string, { color: string, bg: string, icon: string, label: string, badge: string }> = {
        log: { color: '#ffffff', bg: 'rgba(255, 255, 255, 0.02)', icon: '●', label: 'LOG', badge: '#10b981' },
        warn: { color: '#facc15', bg: 'rgba(245, 158, 11, 0.08)', icon: '▲', label: 'WARN', badge: '#f59e0b' },
        error: { color: '#ff4d4d', bg: 'rgba(239, 68, 68, 0.12)', icon: '✕', label: 'ERR', badge: '#ef4444' },
        info: { color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.08)', icon: 'ℹ', label: 'INFO', badge: '#3b82f6' },
        debug: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.05)', icon: '◦', label: 'DEBUG', badge: '#a78bfa' }
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
            id: Math.random().toString(36).substr(2, 9),
            level,
            message: msg,
            timestamp: entry.timestamp || Date.now(),
            stack: entry.stack || ''
        });

        if (logs.length > 500) logs.shift();
        throttledRender();
    });

    // Tab switch: clear console and re-render (new tab's logs will be re-emitted)
    atlas.on('consoleCleared', () => {
        logs.length = 0;
        throttledRender();
    });

    const renderLogs = () => {
        if (!listEl) return;

        const filtered = activeFilter === 'all' ? logs : logs.filter(l => l.level === activeFilter);
        const counts: Record<string, number> = { all: logs.length, log: 0, warn: 0, error: 0, info: 0, debug: 0 };
        logs.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++; });
        Object.keys(countEls).forEach(k => { if (countEls[k]) countEls[k].innerText = String(counts[k] || 0); });

        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

        const displayLogs = filtered.slice(-150);

        if (displayLogs.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:60px; font-style:italic; font-size:12px; font-family:\'Inter\',sans-serif;">No console output recorded.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        displayLogs.forEach(entry => {
            const isExpanded = expandedLogId === entry.id;
            const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.log;

            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = `display:flex; flex-direction:column; border-bottom:1px solid rgba(255,255,255,0.04); background:${isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent'}; margin-bottom:1px;`;

            const item = document.createElement('div');
            item.style.cssText = `padding:12px 16px; border-left:3px solid ${isExpanded ? '#10b981' : cfg.badge}; cursor:pointer; transition: background 0.1s;`;
            item.onmouseover = () => { if (!isExpanded) item.style.background = 'rgba(255,255,255,0.03)'; };
            item.onmouseout = () => { item.style.background = 'transparent'; };

            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:6px; font-family:\'Inter\', sans-serif;';
            header.innerHTML = `<span style="color:${cfg.badge}; font-weight:900; font-size:10px; letter-spacing:0.06em;">${cfg.icon} ${cfg.label}</span>` +
                `<span style="color:#52525b; font-size:10px; margin-left:auto; font-weight:600;">${time}</span>`;
            item.appendChild(header);

            const content = document.createElement('div');
            content.style.cssText = `color:${cfg.color}; word-break:break-all; white-space:${isExpanded ? 'pre-wrap' : 'nowrap'}; overflow:hidden; text-overflow:${isExpanded ? 'clip' : 'ellipsis'}; font-family:'JetBrains Mono', monospace; font-size:11px; line-height:1.5; opacity: 1; font-weight: 500;`;
            content.textContent = entry.message;
            item.appendChild(content);

            item.onclick = () => {
                expandedLogId = isExpanded ? null : entry.id;
                renderLogs();
            };

            rowWrapper.appendChild(item);

            if (isExpanded) {
                const details = document.createElement('div');
                details.style.cssText = 'padding:0 16px 16px 16px; background:transparent; animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);';

                if (entry.stack) {
                    const stackLabel = document.createElement('div');
                    stackLabel.style.cssText = 'color:#ef4444; font-weight:800; font-size:9px; text-transform:uppercase; margin-top:12px; margin-bottom:8px; letter-spacing:0.04em; display:flex; align-items:center; gap:8px;';
                    stackLabel.innerHTML = '<span>Stack Trace</span><div style="flex:1; height:1px; background:rgba(239,68,68,0.2);"></div>';
                    details.appendChild(stackLabel);

                    const stackEl = document.createElement('pre');
                    stackEl.style.cssText = 'background:rgba(239, 68, 68, 0.05); padding:16px; border-radius:8px; border:1px solid rgba(239, 68, 68, 0.2); color:#ef4444; font-size:10px; overflow-x:auto; font-family:\'JetBrains Mono\', monospace; line-height:1.6; margin:0;';
                    stackEl.textContent = entry.stack;
                    details.appendChild(stackEl);
                }
                rowWrapper.appendChild(details);
            }

            fragment.appendChild(rowWrapper);
        });

        listEl.appendChild(fragment);
        if (!expandedLogId) listEl.scrollTop = listEl.scrollHeight;
    };

    atlas.addTool('Console', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';

        const filterBar = document.createElement('div');
        filterBar.className = 'tool-bar';
        filterBar.style.padding = '10px 14px';

        ['all', 'error', 'warn', 'info', 'log'].forEach(key => {
            const btn = document.createElement('button');
            const active = activeFilter === key;
            btn.style.cssText = `background:${active ? 'rgba(255,255,255,0.1)' : 'transparent'}; color:${active ? '#fff' : '#71717a'}; padding:5px 10px; border-radius:6px; font-size:10px; cursor:pointer; border:none; font-weight:700; transition:all 0.15s; text-transform:uppercase;`;
            btn.innerText = key;
            const countSpan = document.createElement('span');
            countSpan.style.opacity = '0.5';
            countSpan.style.marginLeft = '8px';
            countSpan.innerText = '0';
            countEls[key] = countSpan;
            btn.appendChild(countSpan);
            btn.onclick = () => {
                activeFilter = key;
                renderLogs();
            };
            filterBar.appendChild(btn);
        });

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'margin-left:auto; color:#ef4444; font-size:10px; cursor:pointer; background:transparent; border:none; display:flex; align-items:center; gap:6px; font-weight:800; text-transform:uppercase;';
        clearBtn.innerHTML = ICONS.TRASH + ' Clear';
        clearBtn.onclick = () => { logs.length = 0; renderLogs(); };
        filterBar.appendChild(clearBtn);

        container.appendChild(filterBar);

        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:0; background:transparent;';
        container.appendChild(listEl);

        renderLogs();
        return container;
    }, renderLogs);
})();
export { };
