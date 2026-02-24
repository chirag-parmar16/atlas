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

        const atlas = window as any;
        const metrics = atlas.__ATLAS_STORAGE__ || { totalTransfer: 0, resources: [], domSize: 0, localStorageSize: 0, sessionStorageSize: 0, cookieSize: 0, breakdown: { images: 0, scripts: 0, styles: 0, fonts: 0, other: 0 } };

        const createBar = (label: string, value: number, total: number, color: string) => {
            const pct = Math.min(100, (value / total) * 100) || 0;
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:12px;';
            row.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; color:#a1a1aa;">' +
                '<span>' + label + '</span><span>' + formatBytes(value) + '</span></div>' +
                '<div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">' +
                '<div style="height:100%; background:' + color + '; width:' + pct + '%; transition:width 0.5s;"></div></div>';
            return row;
        };

        const summary = document.createElement('div');
        summary.style.cssText = 'background:rgba(255,255,255,0.02); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); margin-bottom:16px;';
        summary.innerHTML = '<div style="font-weight:800; color:#fff; font-size:13px; margin-bottom:12px;">Storage Summary</div>';

        summary.appendChild(createBar('Transfer Size (Session)', metrics.totalTransfer, 1024 * 1024 * 10, '#3b82f6'));
        summary.appendChild(createBar('LocalStorage', metrics.localStorageSize, 1024 * 1024 * 5, '#10b981'));
        summary.appendChild(createBar('SessionStorage', metrics.sessionStorageSize, 1024 * 1024 * 5, '#f59e0b'));
        summary.appendChild(createBar('Cookie Size', metrics.cookieSize, 1024 * 10, '#a78bfa'));
        containerEl.appendChild(summary);

        const heavy = document.createElement('div');
        heavy.style.cssText = 'background:rgba(255,255,255,0.02); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);';
        heavy.innerHTML = '<div style="font-weight:800; color:#fff; font-size:13px; margin-bottom:12px;">Recent Heavy Resources</div>';

        const resList = metrics.resources || [];
        resList.forEach((res: any) => {
            const item = document.createElement('div');
            item.style.cssText = 'font-size:11px; color:#71717a; font-family:"JetBrains Mono", monospace; display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.02);';
            const name = res.name || 'resource';
            item.innerHTML = '<span style="color:#e4e4e7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">' + name + '</span>' +
                '<span style="flex-shrink:0">' + formatBytes(res.size || 0) + '</span>';
            heavy.appendChild(item);
        });
        if (resList.length === 0) {
            heavy.innerHTML += '<div style="color:#52525b; font-size:11px; font-style:italic; padding-top:10px; text-align:center;">No resource data yet.</div>';
        }
        containerEl.appendChild(heavy);
    };

    const atlas = (window as any).Atlas;
    atlas.on('storageUpdated', () => {
        renderStorage();
    });

    atlas.addTool('Storage', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderStorage();
        return containerEl;
    }, renderStorage);
})();
export { };
