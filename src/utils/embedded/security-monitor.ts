
export const SECURITY_MONITOR = `
// security-monitor.js
(function () {
    window.Atlas.addTool('Security', function () {
        const container = document.createElement('div');
        container.style.padding = '10px';
        container.style.color = '#ccc';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';

        const ICONS = {
            LOCK: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
            WARN: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" color="#f59e0b"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            SHIELD: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        };

        const header = document.createElement('div');
        header.innerHTML = \`<span style="color:#10b981; display:flex; align-items:center; gap:6px;">\${ICONS.SHIELD} Security Warden</span> <span style="font-size:10px; color:#666;">(PII & CORS Audit)</span>\`;
        container.appendChild(header);

        // Security Controls
        const controlPanel = document.createElement('div');
        controlPanel.style.padding = '10px';
        controlPanel.style.background = 'rgba(255,255,255,0.05)';
        controlPanel.style.borderRadius = '6px';
        controlPanel.style.display = 'flex';
        controlPanel.style.justifyContent = 'space-between';
        controlPanel.style.alignItems = 'center';

        const modeLabel = document.createElement('span');
        modeLabel.innerText = 'Warden Mode:';
        modeLabel.style.fontSize = '12px';
        modeLabel.style.color = '#fff';

        const modeSelect = document.createElement('select');
        modeSelect.style.background = '#000';
        modeSelect.style.color = '#fff';
        modeSelect.style.border = '1px solid #333';
        modeSelect.style.padding = '4px';
        modeSelect.style.fontSize = '11px';
        modeSelect.innerHTML = \`<option value="Standard">Standard (Log Only)</option><option value="Strict">Strict (Block Insecure)</option>\`;
        
        modeSelect.onchange = () => {
            if (window.setSecurityMode) window.setSecurityMode(modeSelect.value);
        };
        controlPanel.appendChild(modeLabel);
        controlPanel.appendChild(modeSelect);
        container.appendChild(controlPanel);

        // Logs
        const logsHeader = document.createElement('div');
        logsHeader.innerText = 'SECURITY VIOLATIONS';
        logsHeader.style.fontSize = '10px';
        logsHeader.style.color = '#999';
        logsHeader.style.marginTop = '10px';
        logsHeader.style.borderBottom = '1px solid #222';
        container.appendChild(logsHeader);

        const list = document.createElement('div');
        list.style.flex = '1';
        list.style.overflowY = 'auto';
        list.style.fontSize = '12px';
        list.style.fontFamily = 'monospace';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';
        container.appendChild(list);

        const renderLogs = () => {
            list.innerHTML = '';
            
            // Filter Security violations only (per-page isolation handled by backend)
            const rawLogs = window.Atlas.violations.filter(v => {
                return v.source === 'Security Warden' || v.source === 'CORS';
            });
            
            if (rawLogs.length === 0) {
                 list.innerHTML = '<div style="color:#666; text-align:center; margin-top:20px; font-style:italic">No Security Violations detected.</div>';
                 return;
            }

            // Deduplicate
            const grouped = new Map();
            rawLogs.forEach(v => {
                const key = v.source + '|' + v.message + '|' + v.url;
                if (grouped.has(key)) {
                    const existing = grouped.get(key);
                    existing.count++;
                    existing.timestamp = v.timestamp;
                } else {
                    grouped.set(key, { ...v, count: 1 });
                }
            });

            Array.from(grouped.values()).reverse().forEach(v => {
                const item = document.createElement('div');
                item.style.borderLeft = '3px solid #f59e0b';
                item.style.padding = '6px';
                item.style.background = 'rgba(245, 158, 11, 0.1)';
                item.style.cursor = 'pointer';
                item.style.transition = 'background 0.2s';
                
                const countBadge = v.count > 1 ? '<span style="background:#f59e0b; color:#000; font-size:11px; padding:2px 6px; border-radius:10px; margin-left:8px; font-weight:bold;">x' + v.count + '</span>' : '';

                const main = document.createElement('div');
                main.innerHTML = '<div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center;">' +
                        '<span style="color:#f59e0b; font-weight:bold">' + ICONS.WARN + ' ' + v.source + countBadge + '</span>' +
                        '<span style="color:#666; font-size:10px">' + new Date(v.timestamp).toLocaleTimeString() + '</span>' +
                    '</div>' +
                    '<div style="color:#ccc; word-break:break-all;">' + v.message + '</div>';
                item.appendChild(main);

const details = document.createElement('pre');
details.style.display = 'none';
details.style.marginTop = '8px';
details.style.padding = '8px';
details.style.background = '#000';
details.style.fontSize = '9px';
details.style.color = '#f59e0b';
details.style.overflowX = 'auto';
details.style.borderRadius = '3px';
details.style.border = '1px solid rgba(245, 158, 11, 0.2)';
details.innerText = JSON.stringify(v, null, 2);
item.appendChild(details);

item.onclick = () => {
    const isVisible = details.style.display === 'block';
    details.style.display = isVisible ? 'none' : 'block';
    item.style.background = isVisible ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)';
};

list.appendChild(item);
            });
        };

renderLogs();
window.addEventListener('atlas-violation', renderLogs);

// Re-render on URL change (SPA navigation)
let lastRenderedPath = window.location.pathname;
setInterval(() => {
    if (window.location.pathname !== lastRenderedPath) {
        lastRenderedPath = window.location.pathname;
        renderLogs();
    }
}, 1000);

return container;
    });
}) ();
`;
