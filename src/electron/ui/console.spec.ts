/**
 * @jest-environment jsdom
 */

describe('Console UI', () => {
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
            if (name === 'Console') {
                registeredToolFn = cb;
                registeredRenderFn = onRender || (() => { });
            }
        });

        (window as any).Atlas = {
            on: mockOn,
            addTool: mockAddTool
        };

        // Mock requestAnimationFrame for immediate rendering
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });

        // Initialize tool
        jest.isolateModules(() => {
            require('./console');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should register Console tool and listeners', () => {
        expect(mockAddTool).toHaveBeenCalledWith('Console', expect.any(Function), expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('consoleLog', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('consoleCleared', expect.any(Function));
    });

    test('should render empty state correctly', () => {
        const container = registeredToolFn();
        expect(container).toBeInstanceOf(HTMLElement);

        const listEl = container.lastChild as HTMLElement;
        expect(listEl.innerHTML).toContain('No console output recorded');
    });

    test('should receive console logs and render them', () => {
        const container = registeredToolFn();
        const listEl = container.lastChild as HTMLElement;

        eventHandlers['consoleLog']({
            level: 'error',
            message: 'Test error message',
            timestamp: 1234567890
        });

        expect(listEl.innerHTML).toContain('Test error message');
        expect(listEl.innerHTML).toContain('ERR');
    });

    test('should clear logs when consoleCleared event is received', () => {
        const container = registeredToolFn();
        const listEl = container.lastChild as HTMLElement;

        eventHandlers['consoleLog']({ level: 'info', message: 'Test message' });
        expect(listEl.innerHTML).toContain('Test message');

        eventHandlers['consoleCleared']();
        expect(listEl.innerHTML).toContain('No console output recorded');
    });

    test('should filter logs when filter button is clicked', () => {
        const container = registeredToolFn();
        const filterBar = container.firstChild as HTMLElement;
        const listEl = container.lastChild as HTMLElement;

        eventHandlers['consoleLog']({ level: 'error', message: 'Error log' });
        eventHandlers['consoleLog']({ level: 'info', message: 'Info log' });

        expect(listEl.innerHTML).toContain('Error log');
        expect(listEl.innerHTML).toContain('Info log');

        // Click 'error' filter (2nd button)
        const errorBtn = filterBar.querySelectorAll('button')[1];
        errorBtn?.click();

        expect(listEl.innerHTML).toContain('Error log');
        expect(listEl.innerHTML).not.toContain('Info log');
    });
});
