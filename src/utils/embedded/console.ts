
export const CONSOLE_TOOL = `
// console.js
(function () {
    const logs = [];
    let activeFilter = 'all';
    let listEl = null;
    let countEls = {};

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    // PII patterns — same as backend scanForPII
    const PII_PATTERNS = {
        CreditCard: /\\b(?:\\d[ -]*?){13,16}\\b/g,
        AuthToken: /\\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16})\\b/gi,
        Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g
    };

    const scanConsolePII = (msg) => {
        const leaks = [];
        Object.entries(PII_PATTERNS).forEach(([type, regex]) => {
            const matches = msg.match(regex);
            if (matches && matches.length > 0) {
                leaks.push({ type, matches: [...new Set(matches)] });
            }
        });
        return leaks;
    };

    // Monkey-patch console methods
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    const LEVEL_CONFIG = {
        log:   { color: '#a3e635', bg: 'rgba(163,230,53,0.06)', icon: '●', label: 'LOG' },
        warn:  { color: '#facc15', bg: 'rgba(250,204,21,0.08)', icon: '▲', label: 'WRN' },
        error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: '✕', label: 'ERR' },
        info:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', icon: 'ℹ', label: 'INF' },
        debug: { color: '#71717a', bg: 'rgba(113,113,122,0.06)', icon: '◦', label: 'DBG' }
    };

    const captureStack = () => {
        try {
            const stack = new Error().stack || '';
            const lines = stack.split('\\n').filter(l => !l.includes('console.ts') && !l.includes('new Function'));
            return lines.slice(2, 8).join('\\n');
        } catch (e) { return ''; }
    };

    const intercept = (level) => {
        console[level] = function (...args) {
            originalConsole[level].apply(console, args);

            const msg = args.map(a => {
                if (typeof a === 'object') {
                    try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
                }
                return String(a);
            }).join(' ');

            if (msg.includes('[Atlas]') || msg.includes('%c[Atlas]')) return;

            logs.push({
                level,
                message: msg,
                timestamp: Date.now(),
                stack: level === 'error' ? captureStack() : ''
            });

            if (logs.length > 500) logs.shift();

            // PII Detection on console output — report to Security tab
            try {
                const leaks = scanConsolePII(msg);
                if (leaks.length > 0 && window.Atlas && window.Atlas.reportViolation) {
                    leaks.forEach(leak => {
                        window.Atlas.reportViolation(
                            'Security Warden',
                            'PII Leak(' + leak.type + ') detected in console.' + level + '(): ' + leak.matches.join(', '),
                            2
                        );
                    });
                    // Also send to server-side violation history
                    if (window.atlasRecordViolationSrv) {
                        leaks.forEach(leak => {
                            window.atlasRecordViolationSrv({
                                source: 'Security Warden',
                                message: 'PII Leak(' + leak.type + ') detected in console.' + level + '(): ' + leak.matches.join(', '),
                                level: 2,
                                timestamp: Date.now(),
                                url: window.location.href
                            });
                        });
                    }
                }
            } catch (e) {}

            renderLogs();
        };
    };

    Object.keys(originalConsole).forEach(intercept);

    // Capture unhandled errors
    window.addEventListener('error', (e) => {
        logs.push({
            level: 'error',
            message: 'Uncaught: ' + (e.message || String(e.error)),
            timestamp: Date.now(),
            stack: e.error && e.error.stack ? e.error.stack.split('\\n').slice(0, 5).join('\\n') : (e.filename + ':' + e.lineno)
        });
        renderLogs();
    });

    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown';
        logs.push({
            level: 'error',
            message: 'Unhandled Promise: ' + reason,
            timestamp: Date.now(),
            stack: e.reason && e.reason.stack ? e.reason.stack.split('\\n').slice(0, 5).join('\\n') : ''
        });
        renderLogs();
    });

    const renderLogs = () => {
        if (!listEl) return;
        const filtered = activeFilter === 'all' ? logs : logs.filter(l => l.level === activeFilter);

        const counts = { all: logs.length, log: 0, warn: 0, error: 0, info: 0, debug: 0 };
        logs.forEach(l => counts[l.level]++);
        Object.keys(countEls).forEach(k => {
            if (countEls[k]) countEls[k].innerText = counts[k] || 0;
        });

        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;">No console output yet.</div>';
            return;
        }

        filtered.forEach(entry => {
            const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.log;
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px; background:' + cfg.bg + '; border-left:3px solid ' + cfg.color + '; border-radius:4px; font-family:\\'JetBrains Mono\\',\\'Cascadia Code\\',\\'Fira Code\\',monospace; font-size:12px; cursor:' + (entry.stack ? 'pointer' : 'default') + '; transition:background 0.15s;';

            const time = new Date(entry.timestamp).toLocaleTimeString();
            const badge = '<span style="color:' + cfg.color + '; font-weight:700; font-size:11px; min-width:32px; display:inline-block;">' + cfg.icon + ' ' + cfg.label + '</span>';
            const timeSpan = '<span style="color:#52525b; font-size:10px; float:right;">' + time + '</span>';

            const main = document.createElement('div');
            main.innerHTML = badge + timeSpan + '<div style="color:#e4e4e7; margin-top:4px; word-break:break-all; white-space:pre-wrap; line-height:1.5;">' + entry.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
            item.appendChild(main);

            if (entry.stack) {
                const stackEl = document.createElement('pre');
                stackEl.style.cssText = 'display:none; margin-top:8px; padding:8px; background:#0a0a0a; color:' + cfg.color + '; font-size:11px; border-radius:4px; border:1px solid #1f1f23; overflow-x:auto; white-space:pre-wrap; line-height:1.4;';
                stackEl.textContent = entry.stack;
                item.appendChild(stackEl);

                item.onclick = () => {
                    const vis = stackEl.style.display === 'block';
                    stackEl.style.display = vis ? 'none' : 'block';
                };
            }

            listEl.appendChild(item);
        });

        listEl.scrollTop = listEl.scrollHeight;
    };

    window.Atlas.addTool('Console', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; gap:0;';

        // Filter Bar
        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'display:flex; gap:4px; padding:8px 10px; background:rgba(0,0,0,0.3); border-bottom:1px solid #1f1f23; align-items:center; flex-wrap:wrap;';

        const filters = [
            { key: 'all', label: 'All' },
            { key: 'error', label: 'Errors' },
            { key: 'warn', label: 'Warnings' },
            { key: 'info', label: 'Info' },
            { key: 'log', label: 'Logs' },
            { key: 'debug', label: 'Debug' }
        ];

        filters.forEach(f => {
            const btn = document.createElement('button');
            const cfg = LEVEL_CONFIG[f.key] || { color: '#fff' };
            btn.style.cssText = 'background:' + (f.key === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent') + '; border:1px solid ' + (f.key === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent') + '; color:' + (f.key === 'all' ? '#fff' : cfg.color || '#aaa') + '; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:500;';
            const countSpan = document.createElement('span');
            countSpan.style.cssText = 'font-family:monospace; opacity:0.7; font-size:11px;';
            countSpan.innerText = '0';
            countEls[f.key] = countSpan;
            btn.innerText = f.label + ' ';
            btn.appendChild(countSpan);
            btn.onclick = () => {
                activeFilter = f.key;
                filterBar.querySelectorAll('button').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.borderColor = 'transparent';
                });
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.borderColor = 'rgba(255,255,255,0.2)';
                renderLogs();
            };
            filterBar.appendChild(btn);
        });

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'margin-left:auto; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px;';
        clearBtn.innerHTML = ICONS.TRASH + ' Clear';
        clearBtn.onclick = () => { logs.length = 0; renderLogs(); };
        filterBar.appendChild(clearBtn);

        container.appendChild(filterBar);

        // Log List
        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding:10px;';
        container.appendChild(listEl);

        renderLogs();
        return container;
    }, function () {
        renderLogs();
    });
})();
`;
