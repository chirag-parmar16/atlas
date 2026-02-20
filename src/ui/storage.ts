
export const STORAGE = `
// storage.js
(function () {
    let containerEl = null;

    const ICONS = {
        CHART: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
        PACKAGE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        DATABASE: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
        WEIGHT: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>'
    };

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

        const createBar = (label, value, maxValue, color) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:12px;';

            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;';
            header.innerHTML = '<span style="color:#e4e4e7; font-weight:500;">' + label + '</span><span style="color:' + color + '; font-family:\\'JetBrains Mono\\',monospace; font-weight:700;">' + formatBytes(value) + '</span>';
            row.appendChild(header);

            const barBg = document.createElement('div');
            barBg.style.cssText = 'width:100%; height:10px; background:rgba(255,255,255,0.05); border-radius:5px; overflow:hidden;';
            const barFill = document.createElement('div');
            const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
            barFill.style.cssText = 'height:100%; border-radius:5px; transition:width 0.3s; background:' + color + '; width:' + pct + '%;';
            barBg.appendChild(barFill);
            row.appendChild(barBg);

            return row;
        };

        // Calculate sizes
        const domSize = new Blob([document.documentElement.outerHTML]).size;

        let lsSize = 0;
        try {
            Object.keys(localStorage).forEach(k => {
                lsSize += (k.length + (localStorage.getItem(k) || '').length) * 2;
            });
        } catch (e) {}

        let ssSize = 0;
        try {
            Object.keys(sessionStorage).forEach(k => {
                ssSize += (k.length + (sessionStorage.getItem(k) || '').length) * 2;
            });
        } catch (e) {}

        const cookieSize = document.cookie ? new Blob([document.cookie]).size : 0;

        // Resource sizes from Performance API
        let totalTransfer = 0;
        let imgTotal = 0, jsTotal = 0, cssTotal = 0, fontTotal = 0, otherTotal = 0;
        const resources = [];
        try {
            const entries = performance.getEntriesByType('resource');
            entries.forEach(entry => {
                const size = entry.transferSize || entry.encodedBodySize || 0;
                totalTransfer += size;
                resources.push({ name: entry.name, size, type: entry.initiatorType, duration: Math.round(entry.duration) });

                if (entry.initiatorType === 'img' || entry.name.match(/\\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) imgTotal += size;
                else if (entry.initiatorType === 'script' || entry.name.match(/\\.js$/i)) jsTotal += size;
                else if (entry.initiatorType === 'link' || entry.initiatorType === 'css' || entry.name.match(/\\.css$/i)) cssTotal += size;
                else if (entry.name.match(/\\.(woff2?|ttf|eot|otf)$/i)) fontTotal += size;
                else otherTotal += size;
            });
        } catch (e) {}

        const maxVal = Math.max(domSize, lsSize, ssSize, cookieSize, imgTotal, jsTotal, cssTotal, totalTransfer, 1);

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'text-align:center; padding:14px; margin-bottom:14px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); border-radius:8px;';
        header.innerHTML = '<div style="color:#10b981; display:flex; justify-content:center; margin-bottom:6px;">' + ICONS.CHART + '</div>'
            + '<div style="color:#fff; font-weight:700; font-size:14px;">Total Page Weight</div>'
            + '<div style="color:#10b981; font-family:\\'JetBrains Mono\\',monospace; font-size:24px; font-weight:700; margin-top:6px;">' + formatBytes(totalTransfer + domSize) + '</div>'
            + '<div style="color:#52525b; font-size:11px; margin-top:4px;">' + resources.length + ' resources loaded</div>';
        containerEl.appendChild(header);

        // Size Bars
        const barsSection = document.createElement('div');
        barsSection.style.cssText = 'padding:10px; background:rgba(255,255,255,0.02); border-radius:6px; margin-bottom:14px; border:1px solid #1f1f23;';
        barsSection.innerHTML = '<div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:12px; border-bottom:1px solid #27272a; padding-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="color:#3b82f6; display:flex;">' + ICONS.PACKAGE + '</span> Size Breakdown</div>';
        barsSection.appendChild(createBar('DOM (HTML)', domSize, maxVal, '#3b82f6'));
        barsSection.appendChild(createBar('Images', imgTotal, maxVal, '#10b981'));
        barsSection.appendChild(createBar('JavaScript', jsTotal, maxVal, '#f59e0b'));
        barsSection.appendChild(createBar('CSS', cssTotal, maxVal, '#a855f7'));
        barsSection.appendChild(createBar('Fonts', fontTotal, maxVal, '#ec4899'));
        barsSection.appendChild(createBar('Other', otherTotal, maxVal, '#71717a'));
        containerEl.appendChild(barsSection);

        // Storage section
        const storageSection = document.createElement('div');
        storageSection.style.cssText = 'padding:10px; background:rgba(255,255,255,0.02); border-radius:6px; margin-bottom:14px; border:1px solid #1f1f23;';
        storageSection.innerHTML = '<div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:12px; border-bottom:1px solid #27272a; padding-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="color:#10b981; display:flex;">' + ICONS.DATABASE + '</span> Client Storage</div>';
        const storageMax = Math.max(lsSize, ssSize, cookieSize, 1);
        storageSection.appendChild(createBar('LocalStorage', lsSize, storageMax, '#10b981'));
        storageSection.appendChild(createBar('SessionStorage', ssSize, storageMax, '#3b82f6'));
        storageSection.appendChild(createBar('Cookies', cookieSize, storageMax, '#f59e0b'));
        containerEl.appendChild(storageSection);

        // Top 10 heaviest resources
        if (resources.length > 0) {
            const topSection = document.createElement('div');
            topSection.style.cssText = 'padding:10px; background:rgba(255,255,255,0.02); border-radius:6px; border:1px solid #1f1f23;';
            topSection.innerHTML = '<div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:10px; border-bottom:1px solid #27272a; padding-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="color:#f59e0b; display:flex;">' + ICONS.WEIGHT + '</span> Top 10 Heaviest</div>';

            const sorted = resources.sort((a, b) => b.size - a.size).slice(0, 10);
            sorted.forEach((res, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px 0; font-size:11px; font-family:\\'JetBrains Mono\\',monospace; border-bottom:1px solid rgba(255,255,255,0.03);';

                let displayName = res.name;
                try { displayName = new URL(res.name).pathname; } catch (e) {}
                if (displayName.length > 36) displayName = '...' + displayName.slice(-33);

                const typeColors = { img: '#10b981', script: '#f59e0b', link: '#a855f7', css: '#a855f7', fetch: '#3b82f6', xmlhttprequest: '#3b82f6' };
                const typeColor = typeColors[res.type] || '#71717a';

                row.innerHTML = ''
                    + '<span style="color:#52525b; min-width:18px; font-size:11px;">' + (idx + 1) + '.</span>'
                    + '<span style="color:' + typeColor + '; min-width:44px; font-size:10px; text-transform:uppercase; font-weight:600;">' + (res.type || '?') + '</span>'
                    + '<span style="color:#d4d4d8; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + res.name.replace(/"/g, '&quot;') + '">' + displayName + '</span>'
                    + '<span style="color:#facc15; min-width:64px; text-align:right; font-weight:700;">' + formatBytes(res.size) + '</span>'
                    + '<span style="color:#52525b; min-width:50px; text-align:right;">' + res.duration + 'ms</span>';
                topSection.appendChild(row);
            });
            containerEl.appendChild(topSection);
        }
    };

    window.Atlas.addTool('Storage', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:10px; color:#ccc; display:flex; flex-direction:column; gap:0; height:100%; overflow-y:auto;';
        renderStorage();
        return containerEl;
    }, function () {
        renderStorage();
    });
})();
`;
