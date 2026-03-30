/**
 * @jest-environment jsdom
 */

import { TabManager } from './tab-manager';

describe('TabManager', () => {
    let container: HTMLElement;
    let tabBar: HTMLElement;
    let onActivate: jest.Mock;
    let onClose: jest.Mock;
    let tabManager: TabManager;

    beforeEach(() => {
        // Setup simple DOM
        document.body.innerHTML = `
            <div id="tab-bar">
                <button id="atlas-new-tab-btn">+</button>
            </div>
            <div id="container"></div>
        `;
        container = document.getElementById('container')!;
        tabBar = document.getElementById('tab-bar')!;
        onActivate = jest.fn();
        onClose = jest.fn();

        tabManager = new TabManager(container, tabBar, onActivate, onClose);

        // Mock global tab bridge functions
        window.atlasTabBridge = {
            reportActiveTab: jest.fn(),
            onOpenTab: jest.fn()
        };
        window.__atlasSwapTab = jest.fn();
        window.__atlasDeleteTab = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should initialize empty', () => {
        expect(tabManager.count).toBe(0);
        expect(tabManager.getActiveTab()).toBeNull();
    });

    test('should create a new tab', () => {
        const tab = tabManager.createTab('https://example.com');

        expect(tabManager.count).toBe(1);
        expect(tabManager.getActiveTab()).toBe(tab);
        // Webview always starts at 'about:blank' to allow Puppeteer/NetworkInterceptor
        // to attach before real navigation begins (prevents 406 cold-boot errors).
        expect(tab.webview.getAttribute('src')).toBe('about:blank');
        // The intended URL is preserved on the tab object for deferred navigation.
        expect(tab.url).toBe('https://example.com');

        // Assert DOM
        expect(container.contains(tab.webview)).toBe(true);
        expect(tabBar.contains(tab.tabEl)).toBe(true);
        expect(tab.webview.classList.contains('active-tab')).toBe(true);
        expect(tab.tabEl.classList.contains('active')).toBe(true);

        expect(onActivate).toHaveBeenCalledWith(tab);
        expect(window.atlasTabBridge?.reportActiveTab).toHaveBeenCalledWith('https://example.com');
        expect(window.__atlasSwapTab).toHaveBeenCalledWith(tab.id);
    });

    test('should close a tab and open about:blank if it was the last one', () => {
        const tab = tabManager.createTab('https://example.com');
        expect(tabManager.count).toBe(1);

        tabManager.closeTab(tab.id);

        expect(tabManager.count).toBe(1); // Auto-reopens about:blank
        const currentActive = tabManager.getActiveTab();
        expect(currentActive?.url).toBe('about:blank');

        expect(onClose).toHaveBeenCalledWith(tab);
        expect(window.__atlasDeleteTab).toHaveBeenCalledWith(tab.id);
    });

    test('should activate adjacent tab when closing the active tab among many', () => {
        const tab1 = tabManager.createTab('https://example1.com');
        const tab2 = tabManager.createTab('https://example2.com');
        const tab3 = tabManager.createTab('https://example3.com');

        expect(tabManager.count).toBe(3);
        expect(tabManager.getActiveTab()).toBe(tab3); // tab3 is active

        tabManager.closeTab(tab3.id);

        expect(tabManager.count).toBe(2);
        // Should activate tab2
        expect(tabManager.getActiveTab()).toBe(tab2);
        expect(tab2.webview.classList.contains('active-tab')).toBe(true);
    });

    test('should switch active tab explicitly', () => {
        const tab1 = tabManager.createTab('https://example1.com');
        const tab2 = tabManager.createTab('https://example2.com');

        expect(tabManager.getActiveTab()).toBe(tab2);

        tabManager.activateTab(tab1.id);

        expect(tabManager.getActiveTab()).toBe(tab1);
        expect(tab1.webview.classList.contains('active-tab')).toBe(true);
        expect(tab2.webview.classList.contains('active-tab')).toBe(false);

        expect(window.__atlasSwapTab).toHaveBeenCalledWith(tab1.id);
    });

    test('should handle navigation', () => {
        const tab = tabManager.createTab('https://example.com');

        tabManager.navigate('apple.com');

        // Automatically prepends https://
        expect(tab.webview.src).toBe('https://apple.com');
    });
});
