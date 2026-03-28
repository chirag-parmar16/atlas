/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createNetworkInterceptor, NetworkInterceptorConfig, NetworkInterceptorCallbacks } from './network-interceptor';
import { Page, HTTPRequest, Frame } from 'puppeteer-core';

// Mock dependencies
jest.mock('./performance-tracker', () => {
    return {
        PerformanceTracker: jest.fn().mockImplementation(() => ({
            check: jest.fn().mockReturnValue(null) // return null by default, no violation
        }))
    };
});

jest.mock('./security-warden', () => ({
    scanForPII: jest.fn().mockReturnValue([]),
    maskPII: jest.fn().mockImplementation((s: string) => s),
    isInsecureCORS: jest.fn().mockReturnValue(false)
}));

// Provide a mock fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('NetworkInterceptor', () => {
    let mockPage: jest.Mocked<Page>;
    let mockRequest: jest.Mocked<HTTPRequest>;
    let callbacks: jest.Mocked<NetworkInterceptorCallbacks>;
    let config: NetworkInterceptorConfig;

    beforeEach(() => {
        mockPage = {
            exposeFunction: jest.fn().mockResolvedValue(undefined),
            evaluate: jest.fn().mockResolvedValue(undefined),
            isClosed: jest.fn().mockReturnValue(false),
            mainFrame: jest.fn().mockReturnValue({} as Frame),
            url: jest.fn().mockReturnValue('http://localhost'),
            setRequestInterception: jest.fn().mockResolvedValue(undefined),
            on: jest.fn()
        } as unknown as jest.Mocked<Page>;

        mockRequest = {
            url: jest.fn().mockReturnValue('http://example.com/api'),
            frame: jest.fn().mockReturnValue({} as Frame),
            isNavigationRequest: jest.fn().mockReturnValue(false),
            method: jest.fn().mockReturnValue('GET'),
            headers: jest.fn().mockReturnValue({}),
            postData: jest.fn().mockReturnValue(undefined),
            resourceType: jest.fn().mockReturnValue('fetch'),
            continue: jest.fn().mockResolvedValue(undefined),
            abort: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<HTTPRequest>;

        callbacks = {
            onViolation: jest.fn(),
            onNetworkEvent: jest.fn(),
            onLog: jest.fn(),
            onNavigation: jest.fn()
        };

        config = {
            domain: 'example.com',
            localPort: 8080
        };

        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('{"success":true}'))
        });
    });

    let interceptor: any;
    afterEach(async () => {
        if (interceptor) await interceptor.cleanup();
    });

    test('should initialize and attach to page', async () => {
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        await interceptor.init();

        expect(mockPage.exposeFunction).toHaveBeenCalledWith('setSecurityMode', expect.any(Function));
        expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
        expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
        expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
    });

    test('should proxy requests matching the masked domain to localhost', async () => {
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        await interceptor.init();

        // Get the registered request handler
        const requestHandler = (mockPage.on as jest.Mock).mock.calls.find(call => call[0] === 'request')[1];

        await requestHandler(mockRequest);

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:8080/api', expect.objectContaining({
            method: 'GET'
        }));
        expect(mockRequest.respond).toHaveBeenCalled();
        expect(callbacks.onNetworkEvent).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://example.com/api',
            status: 200,
            type: 'fetch'
        }));
    });

    test('should passthrough non-domain requests (like CDNs)', async () => {
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        await interceptor.init();

        mockRequest.url.mockReturnValue('https://cdn.example.org/style.css');
        mockRequest.resourceType.mockReturnValue('image'); // Image type is passed through

        const requestHandler = (mockPage.on as jest.Mock).mock.calls.find(call => call[0] === 'request')[1];
        await requestHandler(mockRequest);

        expect(mockRequest.continue).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should emit violation on proxy connection error', async () => {
        mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        await interceptor.init();

        const requestHandler = (mockPage.on as jest.Mock).mock.calls.find(call => call[0] === 'request')[1];
        await requestHandler(mockRequest);

        expect(mockRequest.respond).toHaveBeenCalledWith(expect.objectContaining({
            status: 502,
            contentType: 'text/html'
        }));
    });

    test('should block external navigation on main frame', async () => {
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        await interceptor.init();

        mockRequest.url.mockReturnValue('https://malicious.com');
        mockRequest.isNavigationRequest.mockReturnValue(true);
        // Simulate main frame request
        mockPage.mainFrame.mockReturnValue(mockRequest.frame() as Frame);

        const requestHandler = (mockPage.on as jest.Mock).mock.calls.find(call => call[0] === 'request')[1];
        await requestHandler(mockRequest);

        expect(mockRequest.abort).toHaveBeenCalledWith('blockedbyclient');
    });

    test('should apply stress injection if configured', async () => {
        interceptor = createNetworkInterceptor(mockPage, config, callbacks);
        interceptor.setStressConfig({ enabled: true, errorRate: 100, latencyRate: 0, dropRate: 0, latencySpike: 0, mockOffline: false, dropPackets: false } as any);
        await interceptor.init();

        const requestHandler = (mockPage.on as jest.Mock).mock.calls.find(call => call[0] === 'request')[1];
        await requestHandler(mockRequest);

        expect(mockRequest.respond).toHaveBeenCalledWith(expect.objectContaining({
            status: 500
        }));
        expect(callbacks.onViolation).toHaveBeenCalledWith(expect.objectContaining({
            source: 'Stress Testing'
        }));
    });
});
