interface WebviewNavigationEvent extends Event {
    url?: string;
    isMainFrame?: boolean;
    title?: string;
    favicons?: string[];
    userGesture?: boolean;
}
declare global {
    interface Window {
        atlasTabBridge?: {
            reportActiveTab: (url: string) => void;
            onOpenTab: (cb: (url: string) => void) => void;
        };
        __atlasSwapTab: (tabId: string) => void;
        __atlasDeleteTab: (tabId: string) => void;
    }
}

/**
 * Atlas Tab Manager
 * 
 * Manages the lifecycle of browser tabs within the Atlas host window.
 * Each tab is backed by an Electron <webview> element. Switching tabs
 * simply toggles visibility — all webviews stay mounted in the DOM so
 * background tabs never lose their state.
 * 
 * Key capabilities:
 *   - createTab(url)  → spawn new webview + tab strip element
 *   - activateTab(id) → make one webview visible, hide the rest
 *   - closeTab(id)    → tear down webview + tab element
 *   - new-window interception → opens _blank links as new tabs
 */

interface ElectronWebview extends HTMLElement {
    src: string;
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
    stop: () => void;
    executeJavaScript: (code: string) => Promise<unknown>;
}

interface AtlasTab {
    id: string;
    webview: ElectronWebview;
    tabEl: HTMLElement;
    url: string;
    title: string;
}

type TabEventCallback = (tab: AtlasTab) => void;

export class TabManager {
    private tabs: Map<string, AtlasTab> = new Map();
    private activeTabId: string | null = null;
    private container: HTMLElement;
    private tabBar: HTMLElement;
    private onActivate: TabEventCallback;
    private onClose: TabEventCallback;
    private tabCounter = 0;
    /** Allowed hostnames — navigation outside these is blocked for user gestures */
    private allowedHostnames: Set<string> = new Set(['localhost', '127.0.0.1']);

    constructor(
        container: HTMLElement,
        tabBar: HTMLElement,
        onActivate: TabEventCallback,
        onClose: TabEventCallback,
        allowedDomain?: string
    ) {
        this.container = container;
        this.tabBar = tabBar;
        this.onActivate = onActivate;
        this.onClose = onClose;
        if (allowedDomain) this.setAllowedOrigins(allowedDomain);
    }

    /**
     * Register the project's masked domain so same-project navigation is always allowed.
     * Call this with the `targetDomain` from atlas.config.json.
     */
    setAllowedOrigins(domain: string) {
        if (!domain) return;
        // Strip protocol and path — just hostname
        try { domain = new URL(domain.includes('://') ? domain : 'https://' + domain).hostname; } catch (_) { }
        if (domain) this.allowedHostnames.add(domain);
    }

    /** Check whether a URL is within the allowed project boundaries. */
    private isAllowedUrl(url: string): boolean {
        if (!url || url === 'about:blank') return true;
        try {
            const parsed = new URL(url);
            // Always allow non-http protocols (file:, data:, etc.)
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
            return this.allowedHostnames.has(parsed.hostname);
        } catch (_) {
            return true; // Relative or unparseable — allow
        }
    }

    /** Create a new tab and optionally navigate to `url`. */
    createTab(url: string = 'about:blank'): AtlasTab {
        const id = `tab-${++this.tabCounter}`;

        // 1. Create the webview
        const webview = document.createElement('webview') as ElectronWebview;
        webview.id = `webview-${id}`;
        webview.className = 'atlas-webview';
        webview.setAttribute('src', url);
        webview.setAttribute('allowpopups', ''); // Required for new-window event
        // No inline styles - let CSS class handle position/size for correct viewport calc
        this.container.appendChild(webview);

        // 2. Create the tab strip element
        const tabEl = document.createElement('div');
        tabEl.className = 'atlas-tab';
        tabEl.dataset.tabId = id;
        tabEl.innerHTML = `
            <span class="atlas-tab-favicon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </span>
            <span class="atlas-tab-title">${url === 'about:blank' ? 'New Tab' : this.getDomain(url)}</span>
            <button class="atlas-tab-close" title="Close tab">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        // Insert before the new-tab button
        const newTabBtn = this.tabBar.querySelector('#atlas-new-tab-btn');
        if (newTabBtn) {
            this.tabBar.insertBefore(tabEl, newTabBtn);
        } else {
            this.tabBar.appendChild(tabEl);
        }

        const tab: AtlasTab = { id, webview, tabEl, url, title: 'New Tab' };
        this.tabs.set(id, tab);

        // 3. Wire tab element click (activate) and close button
        tabEl.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.atlas-tab-close')) return;
            this.activateTab(id);
        });
        tabEl.querySelector('.atlas-tab-close')!.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(id);
        });

        // 4. Wire webview events
        this.wireWebviewEvents(tab);

        // 5. Activate this new tab
        this.activateTab(id);
        return tab;
    }

    /** Make the given tab active, hiding all others.
     *  Always clears HUD data — each tab activation shows a fresh view.
     *  Data re-accumulates from the now-active page's live events. */
    activateTab(id: string) {
        const target = this.tabs.get(id);
        if (!target) return;

        // Hide and deactivate all
        this.tabs.forEach((t) => {
            t.webview.classList.remove('active-tab');
            t.tabEl.classList.remove('active');
        });

        // Show and activate the target via CSS class
        target.webview.classList.add('active-tab');
        target.tabEl.classList.add('active');
        this.activeTabId = id;

        // Tell browser.ts which URL is active
        if (window.atlasTabBridge) {
            window.atlasTabBridge.reportActiveTab(target.url || '');
        }

        // Swap renderer to this tab's stored data bucket (Chrome-style, zero flicker)
        if (typeof window.__atlasSwapTab === 'function') {
            window.__atlasSwapTab(id);
        }

        this.onActivate(target);
    }

    /** Close a tab. If it was active, activate the nearest remaining tab. */
    closeTab(id: string) {
        const tab = this.tabs.get(id);
        if (!tab) return;

        const wasActive = this.activeTabId === id;
        const tabIds = Array.from(this.tabs.keys());
        const idx = tabIds.indexOf(id);

        // Remove DOM elements
        tab.webview.remove();
        tab.tabEl.remove();
        this.tabs.delete(id);
        this.onClose(tab);

        // Delete this tab's data bucket
        if (typeof window.__atlasDeleteTab === 'function') {
            window.__atlasDeleteTab(id);
        }

        // If this was the last tab, open a blank one
        if (this.tabs.size === 0) {
            this.createTab('about:blank');
            return;
        }

        // Activate adjacent tab if this was active
        if (wasActive) {
            const nextId = tabIds[idx + 1] || tabIds[idx - 1];
            if (nextId) this.activateTab(nextId);
        }
    }

    /** Get the active tab object. */
    getActiveTab(): AtlasTab | null {
        return this.activeTabId ? (this.tabs.get(this.activeTabId) || null) : null;
    }

    /** Navigate the active tab to a URL. */
    navigate(url: string) {
        const tab = this.getActiveTab();
        if (tab) {
            if (!url.startsWith('http')) url = 'https://' + url;
            tab.webview.src = url;
        }
    }

    goBack() { this.getActiveTab()?.webview.goBack(); }
    goForward() { this.getActiveTab()?.webview.goForward(); }
    reload() { this.getActiveTab()?.webview.reload(); }

    /** Count of open tabs. */
    get count() { return this.tabs.size; }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private wireWebviewEvents(tab: AtlasTab) {
        const { webview, tabEl } = tab;

        // Inject tab identity so browser.ts can map Puppeteer pages to Electron tabs
        const injectId = () => {
            webview.executeJavaScript(`window.__atlasTabId = "${tab.id}";`).catch(() => {});
        };

        webview.addEventListener('dom-ready', injectId);
        webview.addEventListener('did-start-navigation', injectId);
        webview.addEventListener('did-navigate', injectId);

        // Intercept new-window (target="_blank") → open as tab
        webview.addEventListener('new-window', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            webviewEvent.preventDefault();
            if (webviewEvent.url) {
                this.createTab(webviewEvent.url);
                console.log(`[Atlas] New tab opened from _blank link: ${webviewEvent.url}`);
            }
        });

        // URL updates — block user-gesture navigations to external sites
        webview.addEventListener('did-start-navigation', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            if (!webviewEvent.isMainFrame || !webviewEvent.url) return;

            // If this is a user-initiated navigation to an external hostname, stop it
            if (webviewEvent.userGesture && !this.isAllowedUrl(webviewEvent.url)) {
                webview.stop();
                console.log(`[Atlas] Blocked user navigation to external URL: ${webviewEvent.url}`);
                // Show a brief visual notification via a custom event on the host window
                window.dispatchEvent(new CustomEvent('atlas-nav-blocked', { detail: { url: webviewEvent.url } }));
                return;
            }

            tab.url = webviewEvent.url;
            if (this.activeTabId === tab.id) this.onActivate(tab);
        });

        webview.addEventListener('did-navigate', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            if (webviewEvent.url) {
                tab.url = webviewEvent.url;
                if (this.activeTabId === tab.id) this.onActivate(tab);
            }
        });

        webview.addEventListener('did-navigate-in-page', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            if (webviewEvent.url) {
                tab.url = webviewEvent.url;
                if (this.activeTabId === tab.id) this.onActivate(tab);
            }
        });

        // Title updates
        webview.addEventListener('page-title-updated', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            tab.title = webviewEvent.title || tab.url;
            const titleEl = tabEl.querySelector('.atlas-tab-title');
            if (titleEl) titleEl.textContent = this.truncate(tab.title, 22);
        });

        // Favicon updates
        webview.addEventListener('page-favicon-updated', (e: Event) => {
            const webviewEvent = e as WebviewNavigationEvent;
            if (webviewEvent.favicons && webviewEvent.favicons.length > 0) {
                const faviconEl = tabEl.querySelector('.atlas-tab-favicon');
                if (faviconEl) {
                    faviconEl.innerHTML = `<img src="${webviewEvent.favicons[0]}" width="12" height="12" style="border-radius:2px;" onerror="this.style.display='none'">`;
                }
            }
        });

        // Show webview when page is ready
        webview.addEventListener('did-finish-load', () => {
            if (this.activeTabId === tab.id) webview.style.opacity = '1';
        });

        // Closed by page via window.close()
        webview.addEventListener('close', () => {
            this.closeTab(tab.id);
        });
    }

    private getDomain(url: string): string {
        try { return new URL(url).hostname; } catch { return url; }
    }

    private truncate(str: string, max: number): string {
        return str.length > max ? str.slice(0, max) + '…' : str;
    }
}
