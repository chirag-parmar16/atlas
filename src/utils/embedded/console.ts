
export const CONSOLE = `
// console.js
(function () {
    const capturedLogs = [];
    const originalConsole = { log: console.log, warn: console.warn, error: console.error };

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

        const time = new Date().toLocaleTimeString();
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
        \`;
        mainContainer.appendChild(style); // Fix: Append style to main container so it persists after clear
        mainContainer.appendChild(scrollContainer);

        function appendLog(log) {
            const entry = document.createElement('div');
            entry.className = \`log-entry \${log.type}\`;
            entry.innerHTML = \`<span class="log-time">[\${log.time}]</span> \${log.message}\`;
            
            entry.onclick = () => {
                if (selectedLogEntry) selectedLogEntry.classList.remove('selected');
                selectedLogEntry = entry;
                entry.classList.add('selected');
            };

            scrollContainer.appendChild(entry);

            // Auto-scroll if attached
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }

        // Load existing logs
        capturedLogs.forEach(l => appendLog(l));

        // Listen for new logs (Local Shell)
        const logHandler = (e) => appendLog(e.detail);
        window.addEventListener('atlas-console-log', logHandler);

        // Listen for Bridge logs (Project Iframe)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'ATLAS_LOG') {
                 const { level, args } = event.data;
                 // Synthesize a log entry
                 const message = args.join(' ');
                 // Run security checks (on the Shell side too, for double safety)
                 checkLeaks(message);
                 
                 const time = new Date().toLocaleTimeString();
                 const type = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
                 
                 capturedLogs.push({ type, message, time });
                 appendLog({ type, message, time });
            }
        });
        
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
