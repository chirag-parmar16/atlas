export const pill = document.getElementById('host-pill') as HTMLElement;
export const pillCount = document.getElementById('pill-count') as HTMLElement;
export const menu = document.getElementById('host-menu') as HTMLElement;

// --- ATLAS API (HOST ADAPTER) ---
(window as any).Atlas = {
    Severity: { INFO: 0, WARN: 1, ERROR: 2 },
    tools: [],
    violations: [],
    _listeners: {} as Record<string, Function[]>,
    on: function (event: string, callback: Function) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },
    emit: function (event: string, data?: any) {
        if (this._listeners[event]) {
            this._listeners[event].forEach((cb: any) => cb(data));
        }
    },
    addTool: function (name: string, renderCallback: any, onShow: any) {
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
        const v = { source, message, level, timestamp: Date.now() };
        this.violations.push(v);
        (window as any).updateViolationCount(this.violations.length);
        this.emit('violationsUpdated', this.violations);
    }
};

// --- PIPELINE DATA BRIDGE ---
(window as any).updateViolations = (vils: any[]) => {
    (window as any).Atlas.violations = vils;
    (window as any).Atlas.emit('violationsUpdated', vils);
};

(window as any).updateViolationCount = (count: number) => {
    pillCount.textContent = String(count);
    pill.classList.toggle('has-violations', count > 0);
    pill.classList.add('pulse');
    setTimeout(() => pill.classList.remove('pulse'), 400);
};

(window as any).updateConsole = (entry: any) => {
    (window as any).Atlas.emit('consoleLog', entry);
};

(window as any).updateTraffic = (reqs: any[]) => {
    (window as any).Atlas.networkRequests = reqs;
    (window as any).Atlas.emit('networkTrafficUpdated', reqs);
};

(window as any).updateStorage = (metrics: any) => {
    (window as any).__ATLAS_STORAGE__ = metrics;
    (window as any).Atlas.emit('storageUpdated', metrics);
};

(window as any).updateLinks = (links: any) => {
    (window as any).__ATLAS_LINKS__ = links;
    (window as any).Atlas.emit('linksUpdated', links);
};
