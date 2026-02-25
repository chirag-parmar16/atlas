/**
 * @jest-environment jsdom
 */

describe('Links UI', () => {
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
            if (name === 'Links') {
                registeredToolFn = cb;
                registeredRenderFn = onRender || (() => { });
            }
        });

        (window as any).Atlas = {
            on: mockOn,
            addTool: mockAddTool
        };

        // Mock window.location.search
        delete (window as any).location;
        (window as any).location = { search: '?domain=example.com' };

        jest.isolateModules(() => {
            require('./links');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should register Links tool and listeners', () => {
        expect(mockAddTool).toHaveBeenCalledWith('Links', expect.any(Function), expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('linksUpdated', expect.any(Function));
    });

    test('should render empty links categories', () => {
        (window as any).__ATLAS_LINKS__ = [];

        const container = registeredToolFn();
        expect(container).toBeInstanceOf(HTMLElement);

        // It creates 3 sections
        expect(container.children.length).toBe(3);

        // Sections should indicate 'No links detected'
        Array.from(container.children).forEach(section => {
            expect((section as HTMLElement).innerHTML).toContain('No links detected');
        });
    });

    test('should categorize links correctly', () => {
        (window as any).__ATLAS_LINKS__ = [
            { href: '#top', text: 'Back to top' },
            { href: 'javascript:void(0)', text: 'Do nothing' },
            { href: 'https://example.com/about', text: 'About Us' },
            { href: '/contact', text: 'Contact' },
            { href: 'mailto:test@example.com', text: 'Email' }, // Considered internal because no '://' and doesn't match above? Wait, mailto:test doesnt have :// so it goes to internal.
            { href: 'https://google.com', text: 'Google' }
        ];

        const container = registeredToolFn();

        const internalSection = container.children[0] as HTMLElement;
        const externalSection = container.children[1] as HTMLElement;
        const anchorSection = container.children[2] as HTMLElement;

        // Internal should have 3 items (example.com, /contact, mailto:)
        expect(internalSection.innerHTML).toContain('3');
        expect(internalSection.innerHTML).toContain('About Us');
        expect(internalSection.innerHTML).toContain('Contact');

        // External should have 1 item (google.com)
        expect(externalSection.innerHTML).toContain('1');
        expect(externalSection.innerHTML).toContain('Google');

        // Anchors should have 2 items (#top, javascript:)
        expect(anchorSection.innerHTML).toContain('2');
        expect(anchorSection.innerHTML).toContain('Back to top');
        expect(anchorSection.innerHTML).toContain('Do nothing');
    });

    test('should re-render when linksUpdated event is received', () => {
        (window as any).__ATLAS_LINKS__ = [];
        const container = registeredToolFn();

        expect(container.innerHTML).not.toContain('New Link');

        (window as any).__ATLAS_LINKS__ = [{ href: 'https://example.com/new', text: 'New Link' }];
        eventHandlers['linksUpdated']();

        expect(container.innerHTML).toContain('New Link');
    });
});
