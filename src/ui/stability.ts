
export const STABILITY = `
// stability.js
(function () {
    window.Atlas.addTool('Scalability', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';

        const ICONS = {
            BOLT: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
            FIRE_REAL: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-2.5-5.5-2.5-5.5S6 10.62 6 12a2.5 2.5 0 0 0 2.5 2.5z"></path><path d="M15.5 18.5a3.5 3.5 0 0 0 3.5-3.5c0-1.93-3.5-7.7-3.5-7.7s-3.5 5.77-3.5 7.7a3.5 3.5 0 0 0 3.5 3.5z"></path></svg>',
            CHART: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>'
        };

        // --- SUB-TABS HEADER ---
        const subTabs = document.createElement('div');
        subTabs.style.display = 'flex';
        subTabs.style.background = 'rgba(255,255,255,0.03)';
        subTabs.style.borderBottom = '1px solid #333';
        
        const createSubTab = (label, id, active = false) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            btn.style.flex = '1';
            btn.style.padding = '8px';
            btn.style.background = 'transparent';
            btn.style.border = 'none';
            btn.style.color = active ? '#10b981' : '#aaa';
            btn.style.borderBottom = active ? '2px solid #10b981' : 'none';
            btn.style.fontSize = '11px';
            btn.style.fontWeight = active ? 'bold' : 'normal';
            btn.style.cursor = 'pointer';
            btn.onclick = () => {
                subTabs.querySelectorAll('button').forEach(b => {
                    b.style.color = '#aaa';
                    b.style.borderBottom = 'none';
                    b.style.fontWeight = 'normal';
                });
                btn.style.color = '#10b981';
                btn.style.borderBottom = '2px solid #10b981';
                btn.style.fontWeight = 'bold';
                
                stressPanel.style.display = id === 'stress' ? 'flex' : 'none';
                monitorPanel.style.display = id === 'monitor' ? 'flex' : 'none';
            };
            return btn;
        };

        const stressTab = createSubTab('STRESSORS', 'stress', true);
        const monitorTab = createSubTab('LIVE MONITOR', 'monitor');
        subTabs.appendChild(stressTab);
        subTabs.appendChild(monitorTab);
        container.appendChild(subTabs);

        const contentBlock = document.createElement('div');
        contentBlock.style.flex = '1';
        contentBlock.style.padding = '12px';
        contentBlock.style.overflowY = 'auto';
        container.appendChild(contentBlock);

        // --- PANEL 1: STRESS ---
        const stressPanel = document.createElement('div');
        stressPanel.style.display = 'flex';
        stressPanel.style.flexDirection = 'column';
        stressPanel.style.gap = '15px';
        
        const config = { enabled: false, errorRate: 0, latencyRate: 0, dropRate: 0 };
        const sync = () => { if (window.setStressConfig) window.setStressConfig(config); updateStatusParams(); };

        const updateStatusParams = () => {
             const active = config.enabled;
             toggleBtn.style.background = active ? '#ef4444' : '#333';
             toggleBtn.innerHTML = active ? \`<span style="display:flex; align-items:center; justify-content:center; gap:6px;">\${ICONS.FIRE_REAL} STRESS ACTIVE</span>\` : 'Enable Stress Injection';
             inputs.forEach(i => i.disabled = !active);
        };

        const createSlider = (label, key, max = 100, unit = '%') => {
            const wrapper = document.createElement('div');
            const head = document.createElement('div');
            head.style.display = 'flex'; head.style.justifyContent = 'space-between'; head.style.fontSize = '11px'; head.style.marginBottom = '2px';
            const name = document.createElement('span'); 
            name.innerText = label;
            name.style.color = '#e4e4e7'; // Bright white/grey
            name.style.fontWeight = '500';
            const valDisplay = document.createElement('span'); valDisplay.style.color = '#facc15'; valDisplay.innerText = '0' + unit;
            head.appendChild(name); head.appendChild(valDisplay);
            const range = document.createElement('input');
            range.type = 'range'; range.min = '0'; range.max = max.toString(); range.value = '0';
            range.style.width = '100%'; range.disabled = true;
            range.oninput = () => { config[key] = parseInt(range.value); valDisplay.innerText = config[key] + unit; sync(); };
            wrapper.appendChild(head); wrapper.appendChild(range);
            return { el: wrapper, input: range };
        };

        const inputs = [];
        const errorComp = createSlider('Error Rate (500s)', 'errorRate', 50); stressPanel.appendChild(errorComp.el); inputs.push(errorComp.input);
        const latencyComp = createSlider('Latency Spikes (2-5s)', 'latencyRate', 50); stressPanel.appendChild(latencyComp.el); inputs.push(latencyComp.input);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'action-btn';
        toggleBtn.style.textAlign = 'center';
        toggleBtn.onclick = () => { config.enabled = !config.enabled; sync(); };
        stressPanel.appendChild(toggleBtn);
        contentBlock.appendChild(stressPanel);

        // --- PANEL 2: MONITOR ---
        const monitorPanel = document.createElement('div');
        monitorPanel.style.display = 'none';
        monitorPanel.style.flexDirection = 'column';
        monitorPanel.style.height = '100%';

        const list = document.createElement('div');
        list.style.flex = '1'; list.style.marginTop = '0';
        list.style.fontSize = '11px'; list.style.fontFamily = 'monospace';
        list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '6px';
        monitorPanel.appendChild(list);

        const renderLogs = () => {
            list.innerHTML = '';

            // Show all stability events (non-security)
            const rawLogs = window.Atlas.violations.filter(v => {
                if (v.source === 'Security Warden' || v.source === 'CORS') return false;
                return true;
            });

            if (rawLogs.length === 0) { 
                list.innerHTML = '<div style="color:#71717a; text-align:center; padding-top:40px; font-style:italic">No stability events detected.</div>'; 
                return; 
            }

            // Deduplicate
            const grouped = new Map();
            rawLogs.forEach(v => {
                const key = v.source + '|' + v.message + '|' + v.url;
                if (grouped.has(key)) {
                    const existing = grouped.get(key);
                    existing.count++;
                    existing.timestamp = v.timestamp; // Use latest
                } else {
                    grouped.set(key, { ...v, count: 1 });
                }
            });

            Array.from(grouped.values()).reverse().forEach(v => {
                const item = document.createElement('div');
                item.style.padding = '8px'; item.style.background = 'rgba(255,255,255,0.03)'; item.style.borderRadius = '4px';
                item.style.borderLeft = '2px solid #ef4444';
                item.style.cursor = 'pointer';
                item.style.position = 'relative';
                item.style.transition = 'background 0.2s';
                
                const countBadge = v.count > 1 ? '<span style="background:#ef4444; color:#fff; font-size:9px; padding:1px 4px; border-radius:10px; margin-left:6px;">' + v.count + 'x</span>' : '';

                const main = document.createElement('div');
                main.innerHTML = '<div style="color:#ef4444; font-weight:bold; font-size:10px; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<span>' + v.source + countBadge + '</span>' +
                    '<span style="font-weight:normal; color:#666;">' + new Date(v.timestamp).toLocaleTimeString() + '</span>' +
                '</div><div style="color:#d4d4d8;">' + v.message + '</div>';
                item.appendChild(main);

                const details = document.createElement('pre');
                details.style.display = 'none';
                details.style.marginTop = '8px';
                details.style.padding = '8px';
                details.style.background = '#000';
                details.style.fontSize = '9px';
                details.style.color = '#10b981';
                details.style.overflowX = 'auto';
                details.style.borderRadius = '4px';
                details.style.border = '1px solid #222';
                details.innerText = JSON.stringify(v, null, 2);
                item.appendChild(details);

                item.onclick = () => {
                    const isVisible = details.style.display === 'block';
                    details.style.display = isVisible ? 'none' : 'block';
                    item.style.background = isVisible ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
                };
                
                list.appendChild(item);
            });
        };

        window.addEventListener('atlas-violation', renderLogs);
        renderLogs();

        // Re-render on URL change (SPA navigation)
        let lastRenderedPath = window.location.pathname;
        setInterval(() => {
            if (window.location.pathname !== lastRenderedPath) {
                lastRenderedPath = window.location.pathname;
                renderLogs();
            }
        }, 1000);

        contentBlock.appendChild(monitorPanel);

        updateStatusParams();
        return container;
    });
}) ();
`;
