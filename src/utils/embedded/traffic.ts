
export const TRAFFIC = `
// traffic.js
(function () {
    window.Atlas.addTool('Load', function () {
        const container = document.createElement('div');
        container.style.padding = '10px';
        container.style.background = 'rgba(255,255,255,0.03)';
        container.style.borderRadius = '8px';

        const ICONS = {
             LAUNCH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
             CHECK: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
             CROSS: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        };


        const header = document.createElement('div');
        header.innerText = 'Multiuser Reach (Server-Side)';
        header.style.fontSize = '12px';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '8px';
        header.style.color = '#aaa';

        const stats = document.createElement('div');
        stats.style.marginTop = '8px';
        stats.style.fontSize = '11px';
        stats.style.color = '#888';
        stats.innerText = 'Ready to launch.';

        // --- Throttled UI Updater ---
        let lastUpdate = 0;
        let pendingUpdate = null;

        // Expose global updater that receives raw data
        // Listen for traffic events from Node
        window.addEventListener('atlas-traffic-update', (e) => {
            const { s, f, c, total } = e.detail;
            const now = Date.now();
            pendingUpdate = { s, f, c, total };

            if (c === total || now - lastUpdate > 100) {
                renderStats();
                lastUpdate = now;
            }
        });

        function renderStats() {
            if (!pendingUpdate) return;
            const { s, f, c, total } = pendingUpdate;

            stats.style.color = '#facc15';
            stats.innerHTML = \`Simulating: \${c}/\${total} | <span style="color:#10b981">\${ICONS.CHECK}</span> \${s} | <span style="color:#ef4444">\${ICONS.CROSS}</span> \${f}\`;

            if (c === total) {
                stats.style.color = '#10b981';
                stats.innerHTML += ' (Done)';
            }
        }

        // Also run a 100ms loop to catch any pending updates that didn't trigger immediate render
        setInterval(() => {
            if (pendingUpdate && Date.now() - lastUpdate > 100) {
                renderStats();
                lastUpdate = Date.now();
            }
        }, 100);

        const configRow = document.createElement('div');
        configRow.style.display = 'flex';
        configRow.style.gap = '8px';

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.value = '50';
        countInput.style.width = '60px';
        countInput.style.background = 'rgba(0,0,0,0.2)';
        countInput.style.border = '1px solid #444';
        countInput.style.color = 'white';
        countInput.style.textAlign = 'center';
        countInput.style.borderRadius = '4px';

        const startBtn = document.createElement('button');
        startBtn.className = 'action-btn';
        startBtn.style.flex = '1';
        startBtn.style.background = '#3b82f6';
        startBtn.style.display = 'flex';
        startBtn.style.alignItems = 'center';
        startBtn.style.justifyContent = 'center';
        startBtn.style.gap = '6px';
        startBtn.innerHTML = \`\${ICONS.LAUNCH} Launch Traffic\`;

        startBtn.onclick = async () => {
            const count = parseInt(countInput.value) || 50;
            startBtn.disabled = true;
            countInput.disabled = true;
            startBtn.innerText = 'Running...';
            stats.innerHTML = 'Initializing...';
            stats.style.color = '#facc15';

            try {
                // Call Node.js function
                if (window.startTrafficSim) {
                    await window.startTrafficSim(window.location.href, count);
                } else {
                    throw new Error('Node Bridge not found');
                }
            } catch (e) {
                stats.style.color = 'red';
                stats.innerHTML = 'Error: ' + e.message;
            } finally {
                startBtn.disabled = false;
                countInput.disabled = false;
                startBtn.innerHTML = \`\${ICONS.LAUNCH} Launch Traffic\`;
            }
        };

        configRow.appendChild(countInput);
        configRow.appendChild(startBtn);

        container.appendChild(header);
        container.appendChild(configRow);
        container.appendChild(stats);

        return container;
    });
})();
`;
