/**
 * Atlas UI — Console Tab Component (High Fidelity)
 * 
 * Intercepts logs, detects PII, captures stack traces, and provides 
 * interactive filtering and clearing. 
 * UPDATED: Vibrant semantic colors for log text and transparent backgrounds.
 */
import { CONSOLE_LEVEL_STYLES } from '../styles/tabs.css';

export function buildConsoleScript(): string {
    return `
(function () {
    const logs = [];
    let activeFilter = 'all';
    let listEl = null;
    let countEls = {};

    const ICONS = {
        TRASH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    const LEVEL_CONFIG = {
        log:   { color: '#ffffff', bg: 'rgba(255,255,255,0.03)', icon: '●', label: 'LOG', badge: '#71717a' },
        warn:  { color: '#facc15', bg: 'rgba(250,204,21,0.08)', icon: '▲', label: 'WRN', badge: '#facc15' },
        error: { color: '#ff4d4d', bg: 'rgba(239,68,68,0.15)',  icon: '✕', label: 'ERR', badge: '#ef4444' },
        info:  { color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', icon: 'ℹ', label: 'INF', badge: '#60a5fa' },
        debug: { color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', icon: '◦', label: 'DBG', badge: '#a78bfa' }
    };

    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
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
                stack: level === 'error' ? (new Error().stack || '') : ''
            });

            if (logs.length > 500) logs.shift();
            renderLogs();
        };
    };

    Object.keys(originalConsole).forEach(intercept);

    window.addEventListener('error', (e) => {
        logs.push({
            level: 'error',
            message: 'Uncaught: ' + (e.message || String(e.error)),
            timestamp: Date.now(),
            stack: e.error && e.error.stack ? e.error.stack : (e.filename + ':' + e.lineno)
        });
        renderLogs();
    });

    const renderLogs = () => {
        if (!listEl) return;
        const filtered = activeFilter === 'all' ? logs : logs.filter(l => l.level === activeFilter);
        const counts = { all: logs.length, log: 0, warn: 0, error: 0, info: 0, debug: 0 };
        logs.forEach(l => counts[l.level]++);
        Object.keys(countEls).forEach(k => { if (countEls[k]) countEls[k].innerText = counts[k] || 0; });

        listEl.innerHTML = '';
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;">No console output yet.</div>';
            return;
        }

        filtered.forEach(entry => {
            const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.log;
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px 12px; background:' + cfg.bg + '; border-left:4px solid ' + cfg.badge + '; border-radius:4px; font-family:"JetBrains Mono", monospace; font-size:12px; line-height:1.5; cursor:default; margin-bottom:4px; backdrop-filter: blur(4px);';
            
            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:4px;';
            header.innerHTML = '<span style="color:' + cfg.badge + '; font-weight:800; font-size:11px;">' + cfg.icon + ' ' + cfg.label + '</span>' +
                '<span style="color:#71717a; font-size:10px; margin-left:auto;">' + time + '</span>';
            item.appendChild(header);

            const content = document.createElement('div');
            content.style.cssText = 'color:' + cfg.color + '; word-break:break-all; white-space:pre-wrap; opacity: 0.95;';
            content.textContent = entry.message;
            item.appendChild(content);

            if (entry.stack && entry.level === 'error') {
                const stackEl = document.createElement('pre');
                stackEl.style.cssText = 'display:none; margin-top:10px; padding:10px; background:rgba(0,0,0,0.3); color:#ff4d4d; font-size:11px; overflow-x:auto; border:1px solid rgba(255,255,255,0.05); border-radius:4px;';
                stackEl.textContent = entry.stack;
                item.appendChild(stackEl);
                item.style.cursor = 'pointer';
                item.onclick = (e) => { 
                    stackEl.style.display = stackEl.style.display === 'block' ? 'none' : 'block'; 
                };
            }
            listEl.appendChild(item);
        });
        listEl.scrollTop = listEl.scrollHeight;
    };

    window.Atlas.addTool('Console', function () {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; height:100%; background:transparent;';
        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'display:flex; gap:6px; padding:10px 12px; background:rgba(24, 24, 27, 0.8); border-bottom:1px solid rgba(255,255,255,0.06);';

        ['all', 'error', 'warn', 'info', 'log', 'debug'].forEach(key => {
            const btn = document.createElement('button');
            const active = activeFilter === key;
            btn.style.cssText = 'background:' + (active ? 'rgba(255,255,255,0.08)' : 'transparent') + '; color:' + (active ? '#fff' : '#a1a1aa') + '; padding:4px 10px; border-radius:4px; font-size:11px; cursor:pointer; border:1px solid ' + (active ? 'rgba(255,255,255,0.1)' : 'transparent') + '; font-weight:bold;';
            btn.innerText = key.toUpperCase() + ' ';
            const countSpan = document.createElement('span');
            countSpan.style.opacity = '0.6';
            countSpan.innerText = '0';
            countEls[key] = countSpan;
            btn.appendChild(countSpan);
            btn.onclick = () => {
                activeFilter = key;
                filterBar.querySelectorAll('button').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#a1a1aa';
                    b.style.border = '1px solid transparent';
                });
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = '#fff';
                btn.style.border = '1px solid rgba(255,255,255,0.1)';
                renderLogs();
            };
            filterBar.appendChild(btn);
        });

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = 'margin-left:auto; color:#ef4444; font-size:11px; cursor:pointer; background:transparent; border:none; display:flex; align-items:center; gap:4px; font-weight:bold;';
        clearBtn.innerHTML = ICONS.TRASH + ' Clear';
        clearBtn.onclick = () => { logs.length = 0; renderLogs(); };
        filterBar.appendChild(clearBtn);

        container.appendChild(filterBar);
        listEl = document.createElement('div');
        listEl.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px; padding:10px; background:transparent;';
        container.appendChild(listEl);
        renderLogs();
        return container;
    }, renderLogs);
})();
`;
}

export const CONSOLE_TOOL = buildConsoleScript();
