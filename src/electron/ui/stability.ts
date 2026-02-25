(function () {
    let containerEl: HTMLElement | null = null;
    let activeSubTab: string = 'stressors';

    interface Violation {
        source: string;
        message: string;
        timestamp: number;
    }

    const renderStability = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const nav = document.createElement('div');
        nav.style.cssText = 'display:flex; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:12px; background:rgba(0,0,0,0.2); position:relative;';

        ['STRESSORS', 'LIVE MONITOR'].forEach(label => {
            const btn = document.createElement('button');
            const key = label.toLowerCase().replace(' ', '');
            const active = activeSubTab === key;
            btn.innerText = label;
            btn.style.cssText = `flex:1; padding:12px; border:none; background:transparent; color:${active ? '#10b981' : '#71717a'}; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.2s; letter-spacing:0.05em; position:relative;`;

            if (active) {
                const indicator = document.createElement('div');
                indicator.style.cssText = 'position:absolute; bottom:0; left:0; right:0; height:2px; background:#10b981; box-shadow:0 -2px 10px rgba(16, 185, 129, 0.4);';
                btn.appendChild(indicator);
            }

            btn.onclick = () => { activeSubTab = key; renderStability(); };
            nav.appendChild(btn);
        });
        containerEl.appendChild(nav);

        const content = document.createElement('div');
        content.style.cssText = 'flex:1; display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; padding:0 15px 15px 15px;';

        if (activeSubTab === 'stressors') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:24px;';

            const createSlider = (label: string, id: string, color: string) => {
                const s = document.createElement('div');
                s.className = 'stressor-row';
                s.style.background = 'transparent';
                s.style.padding = '0';

                s.innerHTML = `
                    <div class="stressor-label">
                        <span style="color:#fff; font-weight:700;">${label}</span>
                        <span id="val-${id}" class="stressor-val" style="color:${color}; font-weight:900;">0%</span>
                    </div>
                    <div style="position:relative; width:100%; height:20px; display:flex; align-items:center;">
                        <input type="range" id="${id}" min="0" max="100" value="0" 
                        style="width:100%; accent-color:#10b981; cursor:pointer; background:rgba(255,255,255,0.1); border-radius:10px; height:6px; appearance:none; outline:none; border: 1px solid rgba(255,255,255,0.05);">
                    </div>`;

                const input = s.querySelector('input') as HTMLInputElement;
                const valDisplay = s.querySelector('#val-' + id) as HTMLElement;
                if (input && valDisplay) {
                    input.oninput = () => { valDisplay.innerText = input.value + '%'; };
                }
                return s;
            };

            wrap.appendChild(createSlider('Error Rate (500s)', 'error-rate', '#fcee0a'));
            wrap.appendChild(createSlider('Latency Spikes (2-5s)', 'latency-spike', '#fcee0a'));

            const injectBtn = document.createElement('button');
            injectBtn.style.cssText = 'margin-top:12px; padding:16px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-weight:900; cursor:pointer; transition:all 0.2s; text-transform:uppercase; font-size:13px; letter-spacing:1.5px;';
            injectBtn.innerText = 'Enable Stress Injection';
            injectBtn.onmouseover = () => injectBtn.style.background = 'rgba(255,255,255,0.12)';
            injectBtn.onmouseout = () => injectBtn.style.background = 'rgba(255,255,255,0.08)';

            injectBtn.onclick = () => {
                const errInput = document.getElementById('error-rate') as HTMLInputElement;
                const latInput = document.getElementById('latency-spike') as HTMLInputElement;
                const errorRate = parseInt(errInput.value || '0');
                const latencySpike = parseInt(latInput.value || '0');

                injectBtn.innerText = 'Stress Active';
                injectBtn.style.borderColor = '#10b981';
                injectBtn.style.color = '#10b981';

                const win = window as any;
                if (win.setStressConfig) {
                    win.setStressConfig({
                        errorRate: errorRate / 100,
                        latencySpike: latencySpike / 100
                    });
                }
            };

            wrap.appendChild(injectBtn);
            content.appendChild(wrap);
        } else {
            const monitor = document.createElement('div');
            monitor.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

            const atlas = (window as any).Atlas;
            const violations: Violation[] = (atlas && atlas.violations) || [];
            // Show all violation sources that indicate real problems (includes console warnings)
            const stabilityEvents = violations.filter(v => ['Runtime', 'Resource', 'Promise', 'Network', 'Stress Testing', 'Performance', 'Console', 'Scalability'].includes(v.source));

            if (stabilityEvents.length === 0) {
                monitor.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:60px; font-style:italic; font-size:12px; font-family:\'Inter\',sans-serif;">No stability violations detected.</div>';
            }

            stabilityEvents.slice().reverse().forEach(v => {
                const el = document.createElement('div');
                el.style.cssText = 'padding:12px; background:rgba(239, 68, 68, 0.04); border-left:3px solid #ef4444; border-radius:4px; margin-bottom:2px;';
                el.innerHTML = `<div style="font-size:10px; font-weight:800; color:#ef4444; margin-bottom:6px; display:flex; justify-content:space-between; font-family:'Inter',sans-serif; letter-spacing:0.04em;">` +
                    `<span>✕ ${v.source.toUpperCase()} ERROR</span>` +
                    `<span style="color:#52525b; font-weight:600;">${new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>` +
                    `<div style="font-size:11px; color:#d4d4d8; font-family:'JetBrains Mono', monospace; line-height:1.5; word-break:break-all; opacity:0.9;">${v.message}</div>`;
                monitor.appendChild(el);
            });
            content.appendChild(monitor);
        }

        containerEl.appendChild(content);
    };

    const atlas = (window as any).Atlas;

    atlas.on('violationsUpdated', () => {
        if (activeSubTab === 'livemonitor') renderStability();
    });

    atlas.addTool('Scalability', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:0px; display:flex; flex-direction:column; height:100%; background:transparent; overflow:hidden;';
        renderStability();
        return containerEl;
    }, renderStability);
})();
export { };
