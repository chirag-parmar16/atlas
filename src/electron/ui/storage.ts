(function () {
    let containerEl = null;

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderStorage = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const resources = performance.getEntriesByType('resource');
        const totalSize = resources.reduce((acc, res) => acc + (res.transferSize || 0), 0);
        
        const createBar = (label, value, total, color) => {
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
        
        const lsSize = JSON.stringify(localStorage).length;
        const ssSize = JSON.stringify(sessionStorage).length;
        
        summary.appendChild(createBar('Transfer Size (Session)', totalSize, 1024 * 1024 * 10, '#3b82f6'));
        summary.appendChild(createBar('LocalStorage', lsSize, 1024 * 1024 * 5, '#10b981'));
        summary.appendChild(createBar('SessionStorage', ssSize, 1024 * 1024 * 5, '#f59e0b'));
        containerEl.appendChild(summary);

        const heavy = document.createElement('div');
        heavy.style.cssText = 'background:rgba(255,255,255,0.02); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);';
        heavy.innerHTML = '<div style="font-weight:800; color:#fff; font-size:13px; margin-bottom:12px;">Top 10 Heavy Resources</div>';
        
        const sorted = resources.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 10);
        sorted.forEach(res => {
            const item = document.createElement('div');
            item.style.cssText = 'font-size:11px; color:#71717a; font-family:"JetBrains Mono", monospace; display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.02);';
            const name = res.name.split('/').pop() || 'index';
            item.innerHTML = '<span style="color:#e4e4e7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">' + name + '</span>' +
                '<span style="flex-shrink:0">' + formatBytes(res.transferSize || 0) + '</span>';
            heavy.appendChild(item);
        });
        containerEl.appendChild(heavy);
    };

    window.Atlas.addTool('Storage', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent;';
        renderStorage();
        return containerEl;
    }, renderStorage);
})();
export {};
