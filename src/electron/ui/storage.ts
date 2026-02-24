(function () {
    let containerEl: HTMLElement | null = null;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderStorage = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const atlasData = (window as any).__ATLAS_STORAGE__ || {
            totalTransfer: 0,
            resources: [],
            domSize: 0,
            localStorageSize: 0,
            sessionStorageSize: 0,
            cookieSize: 0
        };

        const createBar = (label: string, value: number, total: number, color: string) => {
            const pct = Math.min(100, (value / total) * 100) || 0;
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:16px;';
            row.innerHTML = `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:10px; font-weight:700; font-family:'Inter', sans-serif;">` +
                `<span style="color:#d4d4d8;">${label}</span>` +
                `<span style="color:${color}; font-family:'JetBrains Mono', monospace; font-weight:800;">${formatBytes(value)}</span>` +
                `</div>` +
                `<div style="height:5px; background:rgba(0,0,0,0.3); border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,0.04);">` +
                `<div style="height:100%; background:${color}; width:${pct}%; transition:width 0.6s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 0 10px ${color}66; border-radius:10px;"></div></div>`;
            return row;
        };

        const summary = document.createElement('div');
        summary.style.cssText = 'background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); margin-bottom:12px;';
        summary.innerHTML = '<div style="font-weight:900; color:#fff; font-size:12px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:10px;">Global Metrics</div>';

        summary.appendChild(createBar('Data Transferred', atlasData.totalTransfer, 1024 * 1024 * 20, '#3b82f6'));
        summary.appendChild(createBar('Local Persistence', atlasData.localStorageSize, 1024 * 1024 * 10, '#10b981'));
        summary.appendChild(createBar('Session Cache', atlasData.sessionStorageSize, 1024 * 1024 * 5, '#f59e0b'));
        summary.appendChild(createBar('Browser Cookies', atlasData.cookieSize, 1024 * 100, '#a78bfa'));
        containerEl.appendChild(summary);

        const heavy = document.createElement('div');
        heavy.style.cssText = 'background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);';
        heavy.innerHTML = '<div style="font-weight:900; color:#fff; font-size:12px; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:10px;">Resource Allocation</div>';

        const resList = atlasData.resources || [];
        if (resList.length === 0) {
            heavy.innerHTML += '<div style="color:#52525b; font-size:11px; font-style:italic; padding:20px 0; text-align:center; font-family:\'Inter\', sans-serif;">Collecting resource impact data...</div>';
        } else {
            const listWrap = document.createElement('div');
            listWrap.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
            resList.forEach((res: any) => {
                const item = document.createElement('div');
                item.style.cssText = 'font-size:11px; color:#a1a1aa; font-family:"JetBrains Mono", monospace; display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03); opacity:0.9; cursor:default;';
                item.onmouseover = () => item.style.color = '#fff';
                item.onmouseout = () => item.style.color = '#a1a1aa';
                const name = res.name || 'unnamed-resource';
                const basename = name.split('/').pop() || name;
                item.innerHTML = `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:12px; font-weight:500;">${basename}</span>` +
                    `<span style="flex-shrink:0; font-weight:700; color:#d4d4d8;">${formatBytes(res.size || 0)}</span>`;
                listWrap.appendChild(item);
            });
            heavy.appendChild(listWrap);
        }
        containerEl.appendChild(heavy);
    };

    const atlas = (window as any).Atlas;
    atlas.on('storageUpdated', () => renderStorage());

    atlas.addTool('Storage', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderStorage();
        return containerEl;
    }, renderStorage);
})();
export { };
