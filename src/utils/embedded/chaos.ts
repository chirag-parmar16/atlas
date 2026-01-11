
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

        const header = document.createElement('div');
        header.innerHTML = '⚡ Chaos Engine <span style="font-size:10px; color:#666; font-weight:normal;">(Random Failure Injection)</span>';
        header.style.fontWeight = 'bold';
        header.style.borderBottom = '1px solid #333';
        header.style.paddingBottom = '5px';
        container.appendChild(header);

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
             toggleBtn.innerText = active ? '🔥 CHAOS ACTIVE 🔥' : 'Enable Chaos';
             
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
