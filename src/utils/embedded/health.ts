
export const HEALTH = `
// health.js
(function () {
    window.Atlas.addTool('Health', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.padding = '10px';
        container.style.color = '#eee';

        const title = document.createElement('h3');
        title.innerText = 'System Health & Violations';
        title.style.margin = '0 0 10px 0';
        title.style.borderBottom = '1px solid #333';
        title.style.paddingBottom = '8px';
        container.appendChild(title);

        const list = document.createElement('div');
        list.style.flex = '1';
        list.style.overflowY = 'auto';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';
        
        // --- CONTROLS SECTION ---
        const controls = document.createElement('div');
        controls.style.padding = '8px 0';
        controls.style.marginBottom = '10px';
        controls.style.borderBottom = '1px solid #333';
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.justifyContent = 'space-between';

        const label = document.createElement('label');
        label.innerText = 'Strict CORS Enforcement';
        label.style.fontSize = '12px';
        label.style.color = '#ccc';
        label.title = 'Blocks Access-Control-Allow-Origin: *';
        
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.style.cursor = 'pointer';
        
        // Load State
        const savedMode = sessionStorage.getItem('atlas-security-mode') || 'Standard';
        toggle.checked = savedMode === 'Strict';
        // Apply Initial State to Backend (if function exists)
        if (window.setSecurityMode) window.setSecurityMode(savedMode);

        toggle.onchange = (e) => {
            const mode = e.target.checked ? 'Strict' : 'Standard';
            sessionStorage.setItem('atlas-security-mode', mode);
            if (window.setSecurityMode) window.setSecurityMode(mode);
            
            // Visual feedback
            const toast = document.createElement('div');
            toast.innerText = 'Security Mode: ' + mode;
            toast.style.position = 'absolute';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = mode === 'Strict' ? '#ef4444' : '#10b981';
            toast.style.color = '#fff';
            toast.style.padding = '4px 12px';
            toast.style.borderRadius = '20px';
            toast.style.fontSize = '12px';
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        };

        controls.appendChild(label);
        controls.appendChild(toggle);
        container.appendChild(controls);

        container.appendChild(list);

        const appendViolation = (v) => {
            // Remove "Healthy" message if present
            const empty = list.querySelector('.empty-state');
            if (empty) empty.remove();

            const item = document.createElement('div');
            item.style.padding = '8px';
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.borderRadius = '6px';
            item.style.borderLeft = '4px solid #fff';
            
            let color = '#ccc';
            let levelText = 'INFO';
            // 0=INFO, 1=WARN, 2=ERROR
            if (v.level === 1) { color = '#f59e0b'; levelText = 'WARN'; }
            if (v.level === 2) { color = '#ef4444'; levelText = 'ERR'; }

            item.style.borderLeftColor = color;
            
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.marginBottom = '4px';
            
            const src = document.createElement('span');
            src.style.fontWeight = 'bold';
            src.style.color = color;
            src.innerText = \`[\${levelText}] \${v.source}\`;
            
            const time = document.createElement('span');
            time.style.fontSize = '11px';
            time.style.color = '#888';
            time.innerText = new Date(v.timestamp).toLocaleTimeString();

            header.appendChild(src);
            header.appendChild(time);
            item.appendChild(header);

            const msg = document.createElement('div');
            msg.style.fontSize = '12px';
            msg.style.fontFamily = 'monospace';
            msg.style.wordBreak = 'break-all';
            msg.innerText = v.message;
            item.appendChild(msg);

            // Prepend functionality? Or append? Usually newest top is better for logs?
            // Let's stick to append for now, or use list.prepend(item)
            list.appendChild(item);
            
            // Auto-scroll
            if (list.parentElement) {
                list.scrollTop = list.scrollHeight;
            }
        };

        const renderAll = () => {
            list.innerHTML = '';
            const violations = window.__ATLAS__ ? window.__ATLAS__.violations : [];

            if (violations.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.innerText = '✅ System Healthy. No violations detected.';
                empty.style.color = '#10b981';
                empty.style.textAlign = 'center';
                empty.style.marginTop = '20px';
                list.appendChild(empty);
                return;
            }

            violations.forEach(v => appendViolation(v));
        };

        renderAll();

        // Listen for real-time updates
        window.addEventListener('atlas-violation', (e) => {
            appendViolation(e.detail);
        });
        
        return container;
    }, () => {
         // onShow: maybe scroll to bottom?
    });
})();
`;
