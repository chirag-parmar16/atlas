/**
 * Atlas UI — Scalability Tab Component (High Fidelity)
 * 
 * Provides stress injection controls and a live monitor for stability events.
 * FIXED: Removed horizontal scroll and updated aesthetics.
 */

export function buildStabilityScript(): string {
    return `
(function () {
    let containerEl = null;
    let activeSubTab = 'stressors';

    const renderStability = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const nav = document.createElement('div');
        nav.style.cssText = 'display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:6px; margin-bottom:15px; overflow:hidden;';
        
        ['Stressors', 'Live Monitor'].forEach(label => {
            const btn = document.createElement('button');
            const key = label.toLowerCase().replace(' ', '');
            const active = activeSubTab === key;
            btn.innerText = label.toUpperCase();
            btn.style.cssText = 'flex:1; padding:10px; border:none; background:' + (active ? 'rgba(255,255,255,0.08)' : 'transparent') + '; color:' + (active ? '#10b981' : '#a1a1aa') + '; font-size:11px; font-weight:bold; cursor:pointer; transition:all 0.2s;';
            btn.onclick = () => { activeSubTab = key; renderStability(); };
            nav.appendChild(btn);
        });
        containerEl.appendChild(nav);

        const content = document.createElement('div');
        content.style.cssText = 'flex:1; display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden;';

        if (activeSubTab === 'stressors') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:20px;';
            
            const createSlider = (label, id, color) => {
                const s = document.createElement('div');
                s.style.width = '100%';
                s.innerHTML = '<div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">' +
                    '<span style="color:#fff; font-weight:600;">' + label + '</span>' +
                    '<span id="val-' + id + '" style="color:' + color + '; font-weight:bold;">0%</span>' +
                    '</div>' +
                    '<div style="position:relative; width:100%; height:24px; display:flex; align-items:center;">' +
                        '<input type="range" id="' + id + '" min="0" max="100" value="0" ' +
                        'style="width:100%; accent-color:' + color + '; cursor:pointer; background:rgba(255,255,255,0.05); border-radius:10px; height:6px; appearance:none; outline:none;">' +
                    '</div>';
                const input = s.querySelector('input');
                input.oninput = () => { s.querySelector('#val-' + id).innerText = input.value + '%'; };
                return s;
            };

            wrap.appendChild(createSlider('Error Rate (5xx)', 'error-rate', '#ef4444'));
            wrap.appendChild(createSlider('Latency Spikes (2-5s)', 'latency-spike', '#f59e0b'));

            const injectBtn = document.createElement('button');
            injectBtn.style.cssText = 'margin-top:20px; padding:14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-weight:bold; cursor:pointer; transition:all 0.2s; text-transform:uppercase; font-size:12px; letter-spacing:1px;';
            injectBtn.innerText = 'Enable Stress Injection';
            injectBtn.onmouseover = () => { injectBtn.style.background = 'rgba(255,255,255,0.08)'; };
            injectBtn.onmouseout = () => { injectBtn.style.background = 'rgba(255,255,255,0.05)'; };
            
            wrap.appendChild(injectBtn);
            content.appendChild(wrap);
        } else {
            const monitor = document.createElement('div');
            monitor.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
            
            const violations = (window.Atlas && window.Atlas.violations) || [];
            const stabilityEvents = violations.filter(v => ['Runtime', 'Resource', 'Promise', 'Network', 'Stress Testing'].includes(v.source));
            
            if (stabilityEvents.length === 0) {
                monitor.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:12px;">No stability events recorded.</div>';
            }

            stabilityEvents.slice().reverse().forEach(v => {
                const el = document.createElement('div');
                el.style.cssText = 'padding:12px; background:rgba(255,255,255,0.02); border-left:4px solid #ef4444; border-radius:6px; border:1px solid rgba(255,255,255,0.04);';
                el.innerHTML = '<div style="font-size:11px; font-weight:bold; color:#fff; margin-bottom:6px; display:flex; justify-content:space-between;">' +
                    '<span>' + v.source.toUpperCase() + ' ERROR</span>' +
                    '<span style="opacity:0.5; font-size:10px;">' + new Date(v.timestamp).toLocaleTimeString() + '</span></div>' +
                    '<div style="font-size:11px; color:#a1a1aa; font-family:\\"JetBrains Mono\\", monospace; line-height:1.5; word-break:break-all;">' + v.message + '</div>';
                monitor.appendChild(el);
            });
            content.appendChild(monitor);
        }

        containerEl.appendChild(content);
    };

    window.Atlas.addTool('Scalability', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; display:flex; flex-direction:column; height:100%; background:transparent; overflow:hidden;';
        renderStability();
        return containerEl;
    }, renderStability);
})();
`;
}

export const STABILITY = buildStabilityScript();
