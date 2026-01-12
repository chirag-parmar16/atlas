
export const CONSOLE = `
// console.js
(function () {
    const capturedLogs = [];
    const processedIds = new Set();
    const originalConsole = { log: console.log, warn: console.warn, error: console.error };

    function shouldLog(message) {
        if (typeof message !== 'string') return true;
        if (message.includes('[Atlas] Injecting Runtime')) return false;
        if (message.includes('[Atlas] Initializing')) return false;
        return true;
    }

    function checkLeaks(message) {
        if (!window.Atlas || !window.Atlas.reportViolation) return;
        
        // 1. PII: Email
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        if (emailRegex.test(message)) {
            window.Atlas.reportViolation('Data Leak', 'Potential Email detected in logs', window.Atlas.Severity.WARN);
        }

        // 2. Financial: Credit Card
        // Improved Regex: Starts with a digit, followed by 12-18 groups of (optional space/dash + digit)
        // This reliably catches "4111 1111...", "4111-1111..." or plain "41111111..."
        const ccMatchers = message.match(/[0-9](?:[ -]?[0-9]){12,18}/g);
        if (ccMatchers) {
             ccMatchers.forEach(match => {
                 const digits = match.replace(/\D/g, '');
                 if (digits.length >= 13 && digits.length <= 19) {
                     // Check if it really looks like a card (has separators OR is exactly 16/15 digits)
                     if (match.includes(' ') || match.includes('-') || digits.length === 16 || digits.length === 15) {
                         window.Atlas.reportViolation('Data Leak', \`Potential Credit Card Number detected: \${match}\`, window.Atlas.Severity.WARN);
                     }
                 }
             });
        }

        // 3. Secrets
        // Simplified Pattern: "Key" followed by "Value" with any separator.
        // We look for common key names.
        const keys = ['password', 'secret', 'token', 'api_key', 'access_token', 'client_secret', 'private_key'];
        // This regex finds the key, skips non-alphanumeric chars (separators), and captures the next token.
        const secretRegex = new RegExp(\`(\${keys.join('|')})\\\\W+([a-zA-Z0-9_\\-]{8,})\`, 'gi');
        
        let match;
        while ((match = secretRegex.exec(message)) !== null) {
            const val = match[2]; // Group 2 is the value
            // Ignore placeholders like 'undefined', 'null', '***********'
            if (val && !val.toLowerCase().includes('undefined') && !val.includes('***')) {
                 window.Atlas.reportViolation('Data Leak', \`Potential Secret detected: \${match[1]}... \`, window.Atlas.Severity.ERROR);
            }
        }
    }

    function captureLog(type, args) {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Run Security Checks
        checkLeaks(message);

        if (!shouldLog(message)) return;

        const time = new Date().toLocaleTimeString();
        const id = \`\${time}|\${type}|\${message}\`;
        
        if (processedIds.has(id)) return;
        processedIds.add(id);

        capturedLogs.push({ type, message, time });

        // Dispatch event to update UI
        window.dispatchEvent(new CustomEvent('atlas-console-log', { detail: { type, message, time } }));
    }

    console.log = (...args) => { captureLog('log', args); originalConsole.log(...args); };
    console.warn = (...args) => { captureLog('warn', args); originalConsole.warn(...args); };
    console.error = (...args) => {
        captureLog('error', args);
        if (window.Atlas && window.Atlas.reportViolation) {
            const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            window.Atlas.reportViolation('Console', msg, window.Atlas.Severity.ERROR);
        }
        originalConsole.error(...args);
    };

    window.Atlas.addTool('Logs', function () {
        let selectedLogEntry = null;

        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.flexDirection = 'column';
        mainContainer.style.height = '100%';
        mainContainer.style.background = '#1e1e1e';

        // --- Toolbar ---
        const toolBar = document.createElement('div');
        toolBar.style.padding = '4px 8px';
        toolBar.style.borderBottom = '1px solid #333';
        toolBar.style.display = 'flex';
        toolBar.style.gap = '10px';
        toolBar.style.alignItems = 'center';

        const createBtn = (text, onClick) => {
            const btn = document.createElement('button');
            btn.innerHTML = text;
            btn.style.background = 'transparent';
            btn.style.border = '1px solid #444';
            btn.style.color = '#ccc';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '10px';
            btn.style.padding = '2px 6px';
            btn.style.borderRadius = '3px';
            btn.onclick = onClick;
            // Hover effect
            btn.onmouseenter = () => btn.style.background = '#333';
            btn.onmouseleave = () => btn.style.background = 'transparent';
            return btn;
        };

        // 1. Clear Button
        toolBar.appendChild(createBtn('&oslash;', () => {
             capturedLogs.length = 0; // Clear array
             const logsDiv = mainContainer.querySelector('.logs-container');
             if (logsDiv) logsDiv.innerHTML = '';
             selectedLogEntry = null;
        }));

        // 2. Copy Console
        toolBar.appendChild(createBtn('Copy All', () => {
            const allText = capturedLogs.map(l => \`[\${l.time}] [\${l.type}] \${l.message}\`).join('\\n');
            navigator.clipboard.writeText(allText);
        }));

        // 3. Copy Selected
        toolBar.appendChild(createBtn('Copy Selected', () => {
            if (selectedLogEntry) {
                 const text = selectedLogEntry.innerText;
                 navigator.clipboard.writeText(text);
            }
        }));

        mainContainer.appendChild(toolBar);

        // --- Log Container ---
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'logs-container'; // marker for clear
        scrollContainer.style.flex = '1';
        scrollContainer.style.overflow = 'auto';
        scrollContainer.style.display = 'flex';
        scrollContainer.style.flexDirection = 'column';
        
        const style = document.createElement('style');
        style.textContent = \`
            .log-entry { font-family: monospace; font-size: 11px; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc; word-break: break-all; cursor: pointer; }
            .log-entry:hover { background: #2a2d3e; }
            .log-entry.selected { background: #37373d; }
            .log-entry.warn { color: #fbbf24; }
            .log-entry.error { color: #f87171; }
            .log-time { color: #666; margin-right: 6px; user-select: none; }
            
            /* JSON Tree Config */
            .log-count { background: #555; color: #fff; padding: 1px 4px; border-radius: 4px; font-size: 9px; margin-right: 6px; display: inline-block; vertical-align: middle; }
            
            /* JSON Tree Config */
            .json-tree { font-family: monospace; font-size: 11px; display: inline-block; vertical-align: top; }
            .json-tree details { margin-left: 0; display: block; }
            .json-tree summary { cursor: pointer; color: #a5b4fc; outline: none; display: list-item; }
            .json-tree summary:hover { color: #818cf8; }
            .json-key { color: #e0e0e0; }
            .json-val-string { color: #a5d6a7; }
            .json-val-num { color: #f48fb1; }
            .json-val-bool { color: #90caf9; }
            .json-val-null { color: #9e9e9e; }
        \`;
        mainContainer.appendChild(style); 
        mainContainer.appendChild(scrollContainer);

        function renderJSON(data) {
            const type = typeof data;
            
            if (data === null) return \`<span class="json-val-null">null</span>\`;
            if (type === 'string') return \`<span class="json-val-string">"\${data}"</span>\`;
            if (type === 'number') return \`<span class="json-val-num">\${data}</span>\`;
            if (type === 'boolean') return \`<span class="json-val-bool">\${data}</span>\`;
            
            if (type === 'object') {
                const isArray = Array.isArray(data);
                const keys = Object.keys(data);
                if (keys.length === 0) return isArray ? '[]' : '{}';
                
                let html = \`<details><summary>\${isArray ? \`[\${keys.length}]\` : \`{\${keys.length}}\`}</summary>\`;
                keys.forEach(key => {
                    html += \`<div style="padding-left:14px;"><span class="json-key">\${key}:</span> \${renderJSON(data[key])}</div>\`;
                });
                html += '</details>';
                return html;
            }
            return String(data);
        }

        let lastLog = null;
        let lastLogEl = null;
        let lastLogCount = 1;

        function appendLog(log) {
            // Check for duplicate
            const isDuplicate = lastLog && lastLog.message === log.message && lastLog.type === log.type;
            
            if (isDuplicate && lastLogEl) {
                lastLogCount++;
                let countBadge = lastLogEl.querySelector('.log-count');
                if (!countBadge) {
                    countBadge = document.createElement('span');
                    countBadge.className = 'log-count';
                    // Insert after time, before content
                    const timeSpan = lastLogEl.querySelector('.log-time');
                    if (timeSpan) timeSpan.after(countBadge);
                }
                countBadge.innerText = lastLogCount;
                return; // Stop here, updated existing
            }

            // New Log
            lastLog = log;
            lastLogCount = 1;

            const entry = document.createElement('div');
            entry.className = \`log-entry \${log.type}\`;
            lastLogEl = entry;
            
            let content = log.message;
            
            // Handle [App] prefix case
            let prefix = '';
            let payload = content;
            if (content.startsWith('[App] ')) {
                prefix = '<span style="color:#aaa; margin-right:4px;">[App]</span>';
                payload = content.substring(6);
            } else if (content.startsWith('[Server] ')) {
                prefix = '<span style="color:#818cf8; margin-right:4px;">[Server]</span>';
                payload = content.substring(9);
            }

            // Attempt smart JSON parsing
            if (typeof payload === 'string' && (payload.trim().startsWith('{') || payload.trim().startsWith('['))) {
                try {
                     const parsed = JSON.parse(payload);
                     content = \`\${prefix}<div class="json-tree">\${renderJSON(parsed)}</div>\`;
                } catch (e) {
                     // fallback to text
                     content = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }
            } else {
                 content = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            entry.innerHTML = \`<span class="log-time">[\${log.time}]</span> \${content}\`;
            
            entry.onclick = (e) => {
                // Don't select if clicking summary/details
                if (e.target.tagName !== 'SUMMARY' && e.target.tagName !== 'DETAILS') {
                    if (selectedLogEntry) selectedLogEntry.classList.remove('selected');
                    selectedLogEntry = entry;
                    entry.classList.add('selected');
                }
            };

            scrollContainer.appendChild(entry);

            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }

        // Load existing logs
        capturedLogs.forEach(l => appendLog(l));

        // Helper to strip ANSI codes
        function stripAnsi(str) {
            return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        }

        // Listen for new logs (Local Shell)
        const logHandler = (e) => {
             // Strip ANSI from server logs before processing
             const cleanMsg = stripAnsi(e.detail.message);
             // Filter noisy build logs
             if (cleanMsg.includes('[Server] >') || cleanMsg.includes('[Server] transformed') || cleanMsg.includes('[Server] rendering chunks')) return;
             
             e.detail.message = cleanMsg;
             appendLog(e.detail);
        };
        window.addEventListener('atlas-console-log', logHandler);


        
        // Cleanup listener when tab might be destroyed (not cleanly supported yet in this simple architecture, but good practice)
        // For now, we rely on the fact that these are robust enough.
        
        return mainContainer;
    },
        // On Show Callback
        () => {
            // Scroll to bottom when shown
            const panel = document.getElementById('panel-Console');
        });
})();
`;
