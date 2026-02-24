(function () {
    let containerEl: HTMLElement | null = null;

    interface Violation {
        source: string;
        message: string;
        timestamp: number;
    }

    const renderSecurity = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const warden = document.createElement('div');
        warden.style.cssText = 'background:rgba(255,255,255,0.02); padding:15px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); margin-bottom:16px;';
        warden.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
            '<span style="font-weight:800; color:#fff; font-size:13px;">Warden Mode</span>' +
            '<span style="background:rgba(16, 185, 129, 0.1); color:#10b981; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:bold;">LOG ONLY</span></div>' +
            '<div style="font-size:11px; color:#71717a; line-height:1.5;">Passive monitoring enabled. Atlas will detect PII leaks and insecure resource loads without blocking.</div>';
        containerEl.appendChild(warden);

        const atlas = (window as any).Atlas;
        const violations: Violation[] = (atlas && atlas.violations) || [];
        const secEvents = violations.filter(v =>
            v.source.includes('Security') ||
            v.source.includes('Warden') ||
            v.source.includes('PII') ||
            v.source.includes('Sensitive')
        );

        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'flex:1; overflow-y:auto;';

        if (secEvents.length === 0) {
            listWrap.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic;">No security violations detected.</div>';
        }

        secEvents.slice().reverse().forEach(v => {
            const el = document.createElement('div');
            el.style.cssText = 'padding:12px; background:rgba(255,255,255,0.02); border-left:3px solid #f59e0b; border-radius:8px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);';
            el.innerHTML = '<div style="display:flex; justify-content:space-between; margin-bottom:6px;">' +
                '<span style="font-size:11px; font-weight:bold; color:#fff;">' + v.source.toUpperCase() + '</span>' +
                '<span style="font-size:10px; color:#52525b; font-family:monospace;">' + new Date(v.timestamp).toLocaleTimeString() + '</span></div>' +
                '<div style="font-size:10px; color:#a1a1aa; font-family:monospace; line-height:1.4;">' + v.message + '</div>';
            listWrap.appendChild(el);
        });

        containerEl.appendChild(listWrap);
    };

    const atlas = (window as any).Atlas;

    // React to live violation updates
    atlas.on('violationsUpdated', () => {
        renderSecurity();
    });

    atlas.addTool('Security', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; background:transparent;';
        renderSecurity();
        return containerEl;
    }, renderSecurity);
})();
export { };

