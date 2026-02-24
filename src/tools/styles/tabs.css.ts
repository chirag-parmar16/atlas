/**
 * Atlas UI — Tab Styles
 * 
 * Common inline styles used across tab components.
 * Extracted from console.ts, networks.ts, storage.ts, etc.
 * 
 * These are CSS applied via element.style in the tab render functions.
 * Grouped here for reference and consistency.
 */

/** Console tab: entry level colors and backgrounds */
export const CONSOLE_LEVEL_STYLES: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    log: { color: '#a3e635', bg: 'rgba(163,230,53,0.06)', icon: '●', label: 'LOG' },
    warn: { color: '#facc15', bg: 'rgba(250,204,21,0.08)', icon: '▲', label: 'WRN' },
    error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: '✕', label: 'ERR' },
    info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', icon: 'ℹ', label: 'INF' },
    debug: { color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', icon: '◆', label: 'DBG' }
};

/** Network tab: status code colors */
export const NETWORK_STATUS_COLORS: Record<string, string> = {
    '2': '#10b981',  // 2xx success
    '3': '#3b82f6',  // 3xx redirect
    '4': '#f59e0b',  // 4xx client error
    '5': '#ef4444',  // 5xx server error
};

/** Violation entry styles */
export const VIOLATION_STYLES = {
    entry: 'padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; border-left:3px solid #f59e0b; margin-bottom:6px;',
    critical: 'border-left-color:#ef4444; background:rgba(239,68,68,0.05);',
    source: 'font-weight:600; color:#e4e4e7; font-size:12px;',
    message: 'color:#a1a1aa; font-size:11px; margin-top:4px; line-height:1.4;',
    timestamp: 'color:#52525b; font-size:10px; font-family:monospace;'
};

/** Common empty state */
export const EMPTY_STATE_STYLE = 'color:#52525b; text-align:center; padding-top:40px; font-style:italic; font-size:13px;';
