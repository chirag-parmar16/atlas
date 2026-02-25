/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Stability UI', () => {
    let mockOn: jest.Mock;
    let mockAddTool: jest.Mock;
    let mockSetStressConfig: jest.Mock;
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
            if (name === 'Scalability') {
                registeredToolFn = cb;
                registeredRenderFn = onRender || (() => { });
            }
        });

        mockSetStressConfig = jest.fn();

        (window as any).Atlas = {
            on: mockOn,
            addTool: mockAddTool,
            violations: []
        };

        (window as any).setStressConfig = mockSetStressConfig;

        jest.isolateModules(() => {
            require('./stability');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should register Scalability tool', () => {
        expect(mockAddTool).toHaveBeenCalledWith('Scalability', expect.any(Function), expect.any(Function));
    });

    test('should render stressors tab by default', () => {
        const container = registeredToolFn();
        expect(container.innerHTML).toContain('Error Rate (500s)');
        expect(container.innerHTML).toContain('Latency Spikes (2-5s)');
        const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Enable Stress Injection'));
        expect(btn).toBeTruthy();
    });

    test('should invoke setStressConfig when Enable Stress Injection is clicked', () => {
        const container = registeredToolFn();
        document.body.appendChild(container);

        // Find inputs and set values
        const inputs = Array.from(container.querySelectorAll('input[type="range"]'));
        const errorInput = inputs[0] as HTMLInputElement;
        const latencyInput = inputs[1] as HTMLInputElement;

        errorInput.value = '50';
        latencyInput.value = '20';
        // Dispatch input event to update display
        errorInput.dispatchEvent(new Event('input'));
        latencyInput.dispatchEvent(new Event('input'));

        const injectBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Enable Stress Injection')) as HTMLButtonElement;
        expect(injectBtn.textContent).toBe('Enable Stress Injection');

        injectBtn.click();

        expect(mockSetStressConfig).toHaveBeenCalledWith({
            errorRate: 0.5,
            latencySpike: 0.2,
            jitter: 0,
            mockOffline: false,
            dropPackets: false
        });

        expect(injectBtn.textContent).toBe('Stress Active');
    });

    test('should switch to live monitor tab and display violations', () => {
        const container = registeredToolFn();

        // Setup mock violations
        (window as any).Atlas.violations = [
            { source: 'Runtime', message: 'Test Runtime Error', timestamp: 1000 },
            { source: 'IgnoredSource', message: 'Should not show', timestamp: 2000 },
            { source: 'Network', message: 'Test Network Error', timestamp: 3000 }
        ];

        // Click LIVE MONITOR tab
        const monitorTabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('LIVE MONITOR')) as HTMLButtonElement;
        monitorTabBtn.click();

        // The content should now show the monitor list
        expect(container.innerHTML).toContain('Test Runtime Error');
        expect(container.innerHTML).toContain('Test Network Error');
        expect(container.innerHTML).not.toContain('Should not show'); // Ignored source
    });

    test('should re-render active monitor tab when violationsUpdated event is received', () => {
        const container = registeredToolFn();

        // Go to live monitor
        const monitorTabBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('LIVE MONITOR')) as HTMLButtonElement;
        monitorTabBtn.click();

        expect(container.innerHTML).toContain('No stability violations detected');

        // Add a new violation
        (window as any).Atlas.violations = [
            { source: 'Console', message: 'New Console Waring', timestamp: 4000 }
        ];

        // Trigger event
        eventHandlers['violationsUpdated']();

        expect(container.innerHTML).toContain('New Console Waring');
    });
});
