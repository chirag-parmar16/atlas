
export const CHAOS = `
// chaos.js
(function () {
    window.Atlas.addTool('Chaos', function () {
        const container = document.createElement('div');
        container.style.padding = '10px';
        container.style.color = '#ccc';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '15px';

        const ICONS = {
            BOLT: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
            FIRE: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-2.5-5.5-2.5-5.5S6 10.62 6 12a2.5 2.5 0 002.5 2.5zM12 10c0-1.38-2.5-5.5-2.5-5.5S7 8.62 7 10a2.5 2.5 0 002.5 2.5c1.38 0 2.5-1.12 2.5-2.5z"></path><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>', // Generic placeholder or actual fire icon
            // Better fire icon path
            FIRE_REAL: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-2.5-5.5-2.5-5.5S6 10.62 6 12a2.5 2.5 0 0 0 2.5 2.5z"></path><path d="M15.5 18.5a3.5 3.5 0 0 0 3.5-3.5c0-1.93-3.5-7.7-3.5-7.7s-3.5 5.77-3.5 7.7a3.5 3.5 0 0 0 3.5 3.5z"></path></svg>'
        };

        const header = document.createElement('div');
        header.innerHTML = \`<span style="color:#facc15; display:flex; align-items:center; gap:6px;">\${ICONS.BOLT} Chaos Engine</span> <span style="font-size:10px; color:#666; font-weight:normal;">(Random Failure Injection)</span>\`;
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';

        // State
        const config = {
            enabled: false,
            errorRate: 0,
            latencyRate: 0,
            dropRate: 0
        };

        // Bridge update
        const sync = () => {
            if (window.setChaosConfig) {
                window.setChaosConfig(config);
            }
            updateStatusParams();
        };

        const updateStatusParams = () => {
             const active = config.enabled;
             toggleBtn.style.background = active ? '#ef4444' : '#333';
             toggleBtn.innerHTML = active ? \`<span style="display:flex; align-items:center; justify-content:center; gap:6px;">\${ICONS.FIRE_REAL} CHAOS ACTIVE \${ICONS.FIRE_REAL}</span>\` : 'Enable Chaos';
             
             statusDiv.innerHTML = active 
                ? \`<span style="color:#ef4444">Injecting failures...</span>\` 
                : \`<span style="color:#666">System Stable</span>\`;

             inputs.forEach(i => i.disabled = !active);
        };

        // UI Builder
        const createSlider = (label, key, max = 100, unit = '%') => {
            const wrapper = document.createElement('div');
            
            const head = document.createElement('div');
            head.style.display = 'flex';
            head.style.justifyContent = 'space-between';
            head.style.fontSize = '11px';
            head.style.marginBottom = '4px';

            const name = document.createElement('span');
            name.innerText = label;
            
            const valDisplay = document.createElement('span');
            valDisplay.style.color = '#facc15';
            valDisplay.innerText = '0' + unit;

            head.appendChild(name);
            head.appendChild(valDisplay);

            const range = document.createElement('input');
            range.type = 'range';
            range.min = '0';
            range.max = max.toString();
            range.value = '0';
            range.style.width = '100%';
            range.disabled = true;

            range.oninput = () => {
                config[key] = parseInt(range.value);
                valDisplay.innerText = config[key] + unit;
                sync();
            };

            wrapper.appendChild(head);
            wrapper.appendChild(range);
            return { el: wrapper, input: range };
        };

        const inputs = [];

        // 1. Error Rate
        const errorComp = createSlider('Error Rate (500s)', 'errorRate', 50);
        inputs.push(errorComp.input);
        container.appendChild(errorComp.el);

        // 2. Latency Spikes
        const latencyComp = createSlider('Latency Spikes (2s-5s)', 'latencyRate', 50);
        inputs.push(latencyComp.input);
        container.appendChild(latencyComp.el);

        // 3. Drop Rate
        const dropComp = createSlider('Packet Loss / Drop', 'dropRate', 20);
        inputs.push(dropComp.input);
        container.appendChild(dropComp.el);

        // Toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.style.padding = '8px';
        toggleBtn.style.border = 'none';
        toggleBtn.style.borderRadius = '4px';
        toggleBtn.style.color = 'white';
        toggleBtn.style.fontWeight = 'bold';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.marginTop = '10px';
        toggleBtn.onclick = () => {
            config.enabled = !config.enabled;
            sync();
        };
        container.appendChild(toggleBtn);

        // Status
        const statusDiv = document.createElement('div');
        statusDiv.style.fontSize = '11px';
        statusDiv.style.textAlign = 'center';
        statusDiv.style.marginTop = '5px';
        container.appendChild(statusDiv);

        updateStatusParams();

        return container;
    });
})();
`;
