import { Violation, ConsoleEntry, NetworkRequest, StorageMetrics, NavigationEntry } from '../engine/state';

export const pill = document.getElementById('host-pill') as HTMLElement;
export const pillCount = document.getElementById('pill-count') as HTMLElement;
export const menu = document.getElementById('host-menu') as HTMLElement;

// ─── PER-TAB DATA STORE ─────────────────────────────────────────────────────
// Each tab gets its own data bucket. On tab switch we swap which bucket
// the UI reads from and re-emit stored data to all listeners — instant, 
// zero-flicker, no data loss. Chrome DevTools style.

interface TabData {
    violations: Violation[];
    requests: NetworkRequest[];
    consoleLogs: ConsoleEntry[];
    storage: StorageMetrics | null;
    links: NavigationEntry[];
}

const tabDataStore = new Map<string, TabData>();
let activeTabId = '';

function getOrCreateTabData(tabId: string): TabData {
    if (!tabDataStore.has(tabId)) {
        tabDataStore.set(tabId, {
            violations: [],
            requests: [],
            consoleLogs: [],
            storage: null,
            links: []
        });
    }
    return tabDataStore.get(tabId)!;
}

function getActiveTabData(): TabData {
    return getOrCreateTabData(activeTabId || '__default__');
}

// ─── ATLAS API (HOST ADAPTER) ───────────────────────────────────────────────

export interface AtlasApi {
    Severity: { INFO: number; WARN: number; ERROR: number };
    tools: { name: string; onShow?: () => void }[];
    violations: Violation[];
    networkRequests: NetworkRequest[];
    _listeners: Record<string, Function[]>;
    on: (event: string, callback: Function) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit: (event: string, data?: any) => void;
    addTool: (name: string, renderCallback?: () => HTMLElement | null, onShow?: () => void) => void;
    reportViolation: (source: string, message: string, level: number) => void;
}

declare global {
    interface Window {
        Atlas: AtlasApi;
        updateViolations: (vils: Violation[], tabId?: string) => void;
        updateViolationCount: (count: number) => void;
        updateConsole: (entry: ConsoleEntry, tabId?: string) => void;
        updateTraffic: (reqs: NetworkRequest[], tabId?: string) => void;
        addNetworkRequest: (req: NetworkRequest, tabId?: string) => void;
        updateStorage: (metrics: StorageMetrics, tabId?: string) => void;
        updateLinks: (links: NavigationEntry[], tabId?: string) => void;
        __atlasSwapTab: (tabId: string) => void;
        __atlasDeleteTab: (tabId: string) => void;
        __ATLAS_STORAGE__: StorageMetrics | null;
        __ATLAS_LINKS__: NavigationEntry[];
    }
}

window.Atlas = {
    Severity: { INFO: 0, WARN: 1, ERROR: 2 },
    tools: [],
    violations: [],
    networkRequests: [],
    _listeners: {} as Record<string, Function[]>,
    on: function (event: string, callback: Function) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit: function (event: string, data?: any) {
        if (this._listeners[event]) {
            this._listeners[event].forEach((cb: Function) => cb(data));
        }
    },
    addTool: function (name: string, renderCallback?: () => HTMLElement | null, onShow?: () => void) {
        const id = name.toLowerCase().replace(/\s+/g, '-');

        const mountTool = () => {
            const tabsContainer = document.getElementById('host-tabs');
            const panelsContainer = document.getElementById('host-panels');

            if (!tabsContainer || !panelsContainer) {
                console.error(`[Atlas HUD] Failed to mount tool '${name}': DOM containers missing.`);
                return;
            }

            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.innerText = name;
            tab.onclick = () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                panel.classList.add('active');
                if (onShow) onShow();
            };
            tabsContainer.appendChild(tab);

            const panel = document.createElement('div');
            panel.className = 'panel';
            panel.id = 'panel-' + id;
            if (renderCallback) {
                const el = renderCallback();
                if (el) panel.appendChild(el);
            }
            panelsContainer.appendChild(panel);

            if (tabsContainer.children.length === 1) {
                tab.classList.add('active');
                panel.classList.add('active');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountTool);
        } else {
            mountTool();
        }

        this.tools.push({ name, onShow });
    },
    reportViolation: function (source: string, message: string, level: number) {
        const v: Violation = { source, message, level, timestamp: Date.now(), url: '' };
        this.violations.push(v);
        // Also store in per-tab bucket
        getActiveTabData().violations.push(v);
        window.updateViolationCount(this.violations.length);
        this.emit('violationsUpdated', this.violations);
    }
};

// ─── PIPELINE DATA BRIDGE (writes into per-tab buckets) ─────────────────────

window.updateViolations = (vils: Violation[], tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.violations = vils;

    // Update UI only if this data belongs to the active tab
    if (targetId === activeTabId || !activeTabId) {
        window.Atlas.violations = data.violations;
        window.Atlas.emit('violationsUpdated', data.violations);
        window.updateViolationCount(data.violations.length);
    }
};

window.updateViolationCount = (count: number) => {
    pillCount.textContent = String(count);
    pill.classList.toggle('has-violations', count > 0);
    pill.classList.add('pulse');
    setTimeout(() => pill.classList.remove('pulse'), 400);
};

window.updateConsole = (entry: ConsoleEntry, tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.consoleLogs.push(entry);

    if (targetId === activeTabId || !activeTabId) {
        window.Atlas.emit('consoleLog', entry);
    }
};

window.updateTraffic = (reqs: NetworkRequest[], tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.requests = reqs;

    if (targetId === activeTabId || !activeTabId) {
        window.Atlas.networkRequests = data.requests;
        window.Atlas.emit('networkTrafficUpdated', data.requests);
    }
};

window.addNetworkRequest = (req: NetworkRequest, tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.requests.push(req);
    if (data.requests.length > 200) data.requests.shift();

    if (targetId === activeTabId || !activeTabId) {
        window.Atlas.networkRequests = data.requests;
        window.Atlas.emit('networkTrafficUpdated', data.requests);
    }
};

window.updateStorage = (metrics: StorageMetrics, tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.storage = metrics;

    if (targetId === activeTabId || !activeTabId) {
        window.__ATLAS_STORAGE__ = metrics;
        window.Atlas.emit('storageUpdated', metrics);
    }
};

window.updateLinks = (links: NavigationEntry[], tabId: string = '') => {
    const targetId = tabId || activeTabId || '__default__';
    const data = getOrCreateTabData(targetId);
    data.links = links;

    if (targetId === activeTabId || !activeTabId) {
        window.__ATLAS_LINKS__ = links;
        window.Atlas.emit('linksUpdated', links);
    }
};

// ─── TAB LIFECYCLE (called by tab-manager.ts) ───────────────────────────────

/**
 * Swap to a tab's stored data and re-emit everything to all panels.
 * Zero flicker — just swaps which data bucket feeds the UI.
 */
window.__atlasSwapTab = (tabId: string) => {
    activeTabId = tabId;
    const data = getOrCreateTabData(tabId);
    const atlas = window.Atlas;

    // Swap all UI state to this tab's stored data
    atlas.violations = data.violations;
    atlas.networkRequests = data.requests;
    window.__ATLAS_STORAGE__ = data.storage;
    window.__ATLAS_LINKS__ = data.links;

    // Re-emit all events so every panel refreshes with this tab's data
    atlas.emit('violationsUpdated', data.violations);
    atlas.emit('networkTrafficUpdated', data.requests);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    atlas.emit('storageUpdated', data.storage as any);
    atlas.emit('linksUpdated', data.links);

    // Update pill count
    window.updateViolationCount(data.violations.length);

    // Re-emit all console logs for this tab so Console panel populates
    atlas.emit('consoleCleared');  // clear first
    data.consoleLogs.forEach((entry: ConsoleEntry) => {
        atlas.emit('consoleLog', entry);
    });
};

/**
 * Delete a tab's data bucket when the tab is closed.
 */
window.__atlasDeleteTab = (tabId: string) => {
    tabDataStore.delete(tabId);
};
