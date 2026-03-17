import { Page, HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { NetworkRequest, Violation, ChaosConfig } from './state';
import { ChaosEngine } from './chaos-engine';
import { ProxyEngine, ProxyCallbacks } from './proxy-engine';
import { isViolation, isChaosConfig } from '../utils/type-guards';

export { NetworkRequest };

export interface NetworkInterceptorConfig {
    domain: string;
    localPort: number;
}

export type NetworkInterceptorCallbacks = ProxyCallbacks;

export function createNetworkInterceptor(
    page: Page,
    config: NetworkInterceptorConfig,
    callbacks: NetworkInterceptorCallbacks
) {
    let lastNavPathname: string = '';
    let isCleanedUp = false;

    const chaosEngine = new ChaosEngine();
    const proxyEngine = new ProxyEngine({
        domain: config.domain,
        localPort: config.localPort
    }, callbacks, chaosEngine);

    const exposeControls = async () => {
        const methods = {
            'setSecurityMode': (mode: unknown) => {
                if (typeof mode === 'string') proxyEngine.setSecurityMode(mode as 'Standard' | 'Strict');
            },
            'atlasRecordViolationSrv': (v: unknown) => {
                if (isViolation(v)) callbacks.onViolation(v);
            },
            'setStressConfig': (c: unknown) => {
                if (isChaosConfig(c)) chaosEngine.setConfig(c);
            },
            'getNetworkHistory': () => proxyEngine.getHistory(),
            'clearNetworkHistory': () => proxyEngine.clearHistory(),
            'getFullViolationHistory': () => proxyEngine.getViolations(),
            'clearViolationHistory': () => proxyEngine.clearViolations()
        };

        for (const [name, fn] of Object.entries(methods)) {
            try { await page.exposeFunction(name, fn); } catch (e) { /* Already exposed */ }
        }
    };

    const handleRequest = async (request: HTTPRequest, targetPage: Page) => {
        const urlString = request.url();
        const url = new URL(urlString);
        const isMainFrame = request.frame() === targetPage.mainFrame();

        if (request.isNavigationRequest() && isMainFrame) {
            const normalize = (p: string) => p.replace(/\/(index\.html?)?$/, '/');
            const newPath = normalize(url.pathname);
            proxyEngine.clearViolations();
            proxyEngine.clearHistory();
            lastNavPathname = url.pathname;
            if (callbacks.onNavigation) callbacks.onNavigation(urlString);
        }

        // Delegate to ProxyEngine
        if (await proxyEngine.handleRequest(request, targetPage, lastNavPathname)) return;

        // Protocols
        if (['about:', 'chrome:', 'data:', 'file:'].includes(url.protocol)) {
            await request.continue();
            return;
        }

        // Block external navigation
        if (isMainFrame && request.isNavigationRequest() && url.hostname !== config.domain && !url.hostname.includes('localhost')) {
            await request.abort('blockedbyclient');
            return;
        }

        await request.continue();
    };

    const attach = async (p: Page) => {
        await p.setRequestInterception(true);
        p.on('close', () => { isCleanedUp = true; });
        p.on('request', async (req) => {
            if (isCleanedUp || p.isClosed()) {
                try { req.abort('blockedbyclient').catch(() => { }); } catch (_) { }
                return;
            }
            await handleRequest(req, p);
        });

        p.on('requestfailed', (req) => {
            const error = req.failure()?.errorText;
            if (error && error !== 'net::ERR_ABORTED' && error !== 'blockedbyclient') {
                callbacks.onViolation({
                    source: 'Network',
                    message: `Resource Failed: ${req.url().split('/').pop()} (${error})`,
                    level: 1,
                    timestamp: Date.now(),
                    url: req.url()
                });
            }
        });
    };

    return {
        init: async () => { await exposeControls(); await attach(page); },
        attach,
        cleanup: async () => { isCleanedUp = true; },
        setSecurityMode: (m: unknown) => {
            if (typeof m === 'string') proxyEngine.setSecurityMode(m as 'Standard' | 'Strict');
        },
        setStressConfig: (c: unknown) => {
            if (isChaosConfig(c)) chaosEngine.setConfig(c);
        },
        getRequestHistory: () => proxyEngine.getHistory(),
        getViolations: () => proxyEngine.getViolations()
    };
}
