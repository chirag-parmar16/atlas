/**
 * @jest-environment jsdom
 */

describe('Storage UI', () => {
    let mockOn: jest.Mock;
    let mockAddTool: jest.Mock;
    let registeredToolFn: () => HTMLElement;
    let registeredRenderFn: () => void;
    let eventHandlers: Record<string, Function>;

    beforeEach(() => {
        document.body.innerHTML = '';
        eventHandlers = {};

        mockOn = jest.fn((event: string, cb: Function) => {
            eventHandlers[event] = cb;
        });

        mockAddTool = jest.fn((name: string, cb: () => HTMLElement, onRender?: () => void) => {
            if (name === 'Storage') {
                registeredToolFn = cb;
                registeredRenderFn = onRender || (() => { });
            }
        });

        (window as any).Atlas = {
            on: mockOn,
            addTool: mockAddTool
        };

        jest.isolateModules(() => {
            require('./storage');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should register Storage tool', () => {
        expect(mockAddTool).toHaveBeenCalledWith('Storage', expect.any(Function), expect.any(Function));
    });

    test('should render default zero state', () => {
        (window as any).__ATLAS_STORAGE__ = undefined;

        const container = registeredToolFn();

        // Metrics should show '0 B'
        expect(container.innerHTML).toContain('Data Transferred</span><span style="color:#3b82f6; font-family:\'JetBrains Mono\', monospace; font-weight:800;">0 B</span>');
        expect(container.innerHTML).toContain('Local Persistence</span><span style="color:#10b981; font-family:\'JetBrains Mono\', monospace; font-weight:800;">0 B</span>');
        expect(container.innerHTML).toContain('Session Cache</span><span style="color:#f59e0b; font-family:\'JetBrains Mono\', monospace; font-weight:800;">0 B</span>');
        expect(container.innerHTML).toContain('Browser Cookies</span><span style="color:#a78bfa; font-family:\'JetBrains Mono\', monospace; font-weight:800;">0 B</span>');

        // Resources should be empty
        expect(container.innerHTML).toContain('Collecting resource impact data...');
    });

    test('should format bytes correctly and render resources', () => {
        (window as any).__ATLAS_STORAGE__ = {
            totalTransfer: 1048576, // 1 MB
            localStorageSize: 2048,  // 2 KB
            sessionStorageSize: 512, // 512 B
            cookieSize: 1073741824,   // 1 GB
            resources: [
                { name: 'https://example.com/asset.js', size: 10240, duration: 100 },
                { name: 'index.html', size: 500, duration: 10 }
            ]
        };

        const container = registeredToolFn();

        expect(container.innerHTML).toContain('1 MB');
        expect(container.innerHTML).toContain('2 KB');
        expect(container.innerHTML).toContain('512 B');
        expect(container.innerHTML).toContain('1 GB');

        // Check resources rendering
        expect(container.innerHTML).toContain('asset.js'); // Uses basename
        expect(container.innerHTML).toContain('10 KB'); // Formatted size for asset.js (10240 bytes is 10 KB)
        expect(container.innerHTML).toContain('index.html');
        expect(container.innerHTML).toContain('500 B');
    });

    test('should re-render when storageUpdated event is received', () => {
        (window as any).__ATLAS_STORAGE__ = undefined;
        const container = registeredToolFn();

        expect(container.innerHTML).toContain('0 B');

        (window as any).__ATLAS_STORAGE__ = {
            totalTransfer: 2097152, // 2 MB
            resources: []
        };

        eventHandlers['storageUpdated']();

        expect(container.innerHTML).toContain('2 MB');
    });
});
