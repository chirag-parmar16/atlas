import { Page, HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { NetworkRequest, Violation } from './state';
import { PerformanceTracker } from './performance-tracker';
import { ChaosEngine } from './chaos-engine';
import { SecurityScanner } from './security-scanner';
import { headersSchema, queryParamsSchema } from './validation';
import { StrictWarden } from './route-warden';

export interface ProxyConfig {
    domain: string;
    localPort: number;
    strictMode?: boolean;
    basePath?: string;
    allowedRoutes?: string[];
    appUrl?: string;
}

export interface ProxyCallbacks {
    onViolation: (v: Violation) => void;
    onNetworkEvent: (req: NetworkRequest) => void;
    onLog: (msg: string) => void;
    onNavigation: (url: string) => void;
}

export class ProxyEngine {
    private performanceTracker = new PerformanceTracker();
    private securityScanner = new SecurityScanner();
    private strictWarden = new StrictWarden();
    private requestLogHistory: NetworkRequest[] = [];
    private currentPageViolations: Violation[] = [];

    constructor(
        private config: ProxyConfig,
        private callbacks: ProxyCallbacks,
        private chaosEngine: ChaosEngine
    ) { }

    public getHistory() { return this.requestLogHistory; }
    public getViolations() { return this.currentPageViolations; }
    public clearHistory() { this.requestLogHistory = []; }
    public clearViolations() { this.currentPageViolations = []; }
    public setSecurityMode(mode: 'Standard' | 'Strict' | 'Offline') { this.securityScanner.setMode(mode); }

    public async handleRequest(request: HTTPRequest, page: Page, lastNavPath: string): Promise<boolean> {
        const urlString = request.url();
        const url = new URL(urlString);
        const { domain, localPort } = this.config;

        // 1. Chaos Injection
        if (await this.chaosEngine.inject(request, this.callbacks.onViolation)) {
            return true;
        }

        // 2. Proxy Logic
        if (url.hostname === domain) {
            const targetPath = url.pathname;

            // --- STRICT WARDEN CHECKS ---
            const shouldBlock = this.strictWarden.checkRequest(request, url, this.config, this.callbacks.onViolation, this.callbacks.onLog);
            if (shouldBlock) {
                 await request.respond({
                     status: 404,
                     contentType: 'text/html',
                     body: `<html><body><h1>Atlas Edge Block</h1><p>Route Warden actively blocked this request in Strict Mode.</p></body></html>`
                 });
                 return true;
            }

            // --- HTTP Input Validation ---
            const headersValidation = headersSchema.safeParse(request.headers());
            if (!headersValidation.success) {
                this.callbacks.onLog(`[Security Warden] Blocked request due to malformed headers on ${url.pathname}`);
                this.callbacks.onViolation({
                    source: 'Security Warden',
                    message: `Malformed headers on ${url.pathname}`,
                    level: 2,
                    timestamp: Date.now(),
                    url: urlString
                });
                await request.abort('blockedbyclient');
                return true;
            }

            const paramsObj = Object.fromEntries(url.searchParams.entries());
            const paramsValidation = queryParamsSchema.safeParse(paramsObj);
            if (!paramsValidation.success) {
                this.callbacks.onLog(`[Security Warden] Blocked request due to malformed query params on ${url.pathname}`);
                this.callbacks.onViolation({
                    source: 'Security Warden',
                    message: `Malformed query parameters on ${url.pathname}`,
                    level: 2,
                    timestamp: Date.now(),
                    url: urlString
                });
                await request.abort('blockedbyclient');
                return true;
            }

            const localUrl = `http://localhost:${localPort}${targetPath}${url.search}`;

            try {
                const startTime = Date.now();
                const headers: Record<string, string> = { 
                    ...request.headers(), 
                    'x-forwarded-proto': 'https',
                    'x-forwarded-host': request.headers()['host'] || domain,
                };
                
                // Audit Fix: Remove manual 'host' override. Modern fetch/undici 
                // generates the correct Host header from the URL. Manual overrides 
                // are often rejected by the runtime or backend WAFs.
                delete headers['host'];

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Proxy Timeout

                const method = request.method();
                const hasBody = method !== 'GET' && method !== 'HEAD' && !!request.postData();

                const response = await fetch(localUrl, {
                    method,
                    headers: headers as HeadersInit,
                    body: hasBody ? request.postData() : undefined,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const buffer = await response.arrayBuffer();
                const duration = Date.now() - startTime;
                const size = buffer.byteLength;

                // Performance check
                const perfViolation = this.performanceTracker.check(url.pathname, duration, page.url());
                if (perfViolation) this.callbacks.onViolation(perfViolation);

                const resHeaders: Record<string, string | string[]> = Object.fromEntries(response.headers.entries());

                // Cookie handling (Node 18+ style)
                if (typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function') {
                    const cookies = (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
                    if (cookies?.length > 0) resHeaders['set-cookie'] = cookies;
                }

                // Security headers manipulation
                delete resHeaders['x-frame-options'];
                delete resHeaders['content-security-policy'];
                delete resHeaders['content-length'];
                delete resHeaders['content-encoding'];
                delete resHeaders['transfer-encoding'];

                const networkEvent: NetworkRequest = {
                    id: Math.random().toString(36).substring(7),
                    url: url.href,
                    method: request.method(),
                    status: response.status,
                    type: headers['x-atlas-audit'] ? 'Audit' : request.resourceType(),
                    size,
                    time: duration,
                    reqHeaders: JSON.parse(JSON.stringify(request.headers())),
                    resHeaders: JSON.parse(JSON.stringify(resHeaders)),
                    body: '',
                    _page: lastNavPath || '/'
                };

                // HTTP error violations
                if (response.status >= 400) {
                    this.callbacks.onViolation({
                        source: 'Network',
                        message: `HTTP ${response.status} on ${url.pathname}`,
                        level: 2, // Always critical
                        timestamp: Date.now(),
                        url: urlString
                    });
                }

                // Body capture and PII scan
                const contentType = response.headers.get('content-type') || '';
                const isTextual = contentType.includes('json') || 
                                 contentType.includes('text') || 
                                 contentType.includes('xml') || 
                                 contentType.includes('javascript') || 
                                 contentType.includes('css');

                if (isTextual) {
                    const str = Buffer.from(buffer).toString('utf-8');
                    networkEvent.body = str.length > 100000 ? str.substring(0, 100000) + '... (Truncated)' : str;

                    // Identity Harvesting (Zero Assumption)
                    // We try to find the current user's identity to avoid false positives.
                    const authHeader = request.headers()['authorization'] || '';
                    const authorizedTokens: string[] = [];
                    if (authHeader.startsWith('Bearer ')) authorizedTokens.push(authHeader.substring(7));
                    
                    // Harvest email from cookies or headers if possible
                    const cookieStr = request.headers()['cookie'] || '';
                    const emailMatch = cookieStr.match(/user_email=([^;]+)/) || 
                                     str.match(/"email"\s*:\s*"([^"]+)"/); // Optimistic harvest from JSON
                    
                    const envEmail = process.env.ATLAS_USER_EMAIL;
                    const envTokens = process.env.ATLAS_AUTHORIZED_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || [];

                    const identityContext = {
                        email: emailMatch ? emailMatch[1] : envEmail,
                        authorizedTokens: [...authorizedTokens, ...envTokens]
                    };

                    this.securityScanner.scanResponse(
                        url.pathname, 
                        urlString, 
                        str, 
                        contentType, 
                        contentType.includes('html'), 
                        false, 
                        identityContext,
                        this.callbacks.onViolation, 
                        this.callbacks.onLog
                    );
                } else {
                    networkEvent.body = `[Binary Data: ${contentType}]`;
                }

                this.requestLogHistory.push(networkEvent);
                if (this.requestLogHistory.length > 500) this.requestLogHistory.shift();
                this.callbacks.onNetworkEvent(networkEvent);

                // CORS check
                this.securityScanner.checkCORS(url.pathname, urlString, resHeaders, this.callbacks.onViolation);

                await request.respond({
                    status: response.status,
                    contentType: response.headers.get('content-type') || undefined,
                    headers: resHeaders,
                    body: Buffer.from(buffer)
                });
                return true;

            } catch (error) {
                const errorMsg = (error as Error).message || 'Unknown Error';
                await request.respond({
                    status: 502,
                    contentType: 'text/html',
                    body: `<html><body><h1>Atlas Proxy Error</h1><p>${errorMsg}</p></body></html>`
                });
                return true;
            }
        }
        return false;
    }
}
