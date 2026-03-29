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
    onTrafficCleared?: () => void;
}

export class ProxyEngine {
    private initializationComplete = false;
    private initResolver: (() => void) | null = null;
    private initPromise: Promise<void>;

    private performanceTracker = new PerformanceTracker();
    private securityScanner = new SecurityScanner();
    private strictWarden = new StrictWarden();
    private requestLogHistory: NetworkRequest[] = [];
    private currentPageViolations: Violation[] = [];

    constructor(
        private config: ProxyConfig,
        private callbacks: ProxyCallbacks,
        private chaosEngine: ChaosEngine
    ) { 
        this.initPromise = new Promise(resolve => {
            this.initResolver = resolve;
        });
    }

    /** Signal that Atlas has established "Full Control" and the project can now be served. */
    public setInitialized() {
        if (this.initializationComplete) return;
        this.initializationComplete = true;
        if (this.initResolver) this.initResolver();
    }

    public getHistory() { return this.requestLogHistory; }
    public getViolations() { return this.currentPageViolations; }
    public clearHistory() { 
        this.requestLogHistory = []; 
        this.callbacks.onTrafficCleared?.();
    }
    public clearViolations() { this.currentPageViolations = []; }
    public setSecurityMode(mode: 'Standard' | 'Strict' | 'Offline') { this.securityScanner.setMode(mode); }

    public async handleRequest(request: HTTPRequest, page: Page, lastNavPath: string): Promise<boolean> {
        // 0. Initialization Gate: Hold the very first document request until Atlas is "Ready"
        // This prevents the "Raw Render" before TabID/Auth/Handshake is complete.
        if (!this.initializationComplete && request.isNavigationRequest() && request.resourceType() === 'document') {
            await this.initPromise;
        }

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

            const localUrl = `http://127.0.0.1:${localPort}${targetPath}${url.search}`;

            try {
                const startTime = Date.now();
                const headers: Record<string, string> = { 
                    ...request.headers(), 
                    'x-forwarded-proto': 'https',
                    'x-forwarded-host': request.headers()['host'] || domain,
                    // Keep the original 'host' header intact so the backend knows its masked domain
                    // This is essential for absolute redirects to work properly.
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Proxy Timeout

                const method = request.method();
                const hasBody = method !== 'GET' && method !== 'HEAD' && !!request.postData();

                let response: Response;
                try {
                    response = await fetch(localUrl, {
                        method,
                        headers: headers as HeadersInit,
                        body: hasBody ? request.postData() : undefined,
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

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

                // Skip logging for internal Atlas requests (e.g. link scanner scans)
                const isInternalScan = headers['x-atlas-internal'] === 'link-scan';

                if (!isInternalScan) {
                    // HTTP error violations
                    if (response.status >= 400) {
                        this.callbacks.onViolation({
                            source: 'Network',
                            message: `HTTP ${response.status} on ${url.pathname}`,
                            level: 2,
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

                        const authHeader = request.headers()['authorization'] || '';
                        const authorizedTokens: string[] = [];
                        if (authHeader.startsWith('Bearer ')) authorizedTokens.push(authHeader.substring(7));
                        
                        const cookieStr = request.headers()['cookie'] || '';
                        const emailMatch = cookieStr.match(/user_email=([^;]+)/) || 
                                         str.match(/"email"\s*:\s*"([^"]+)"/); 
                        
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
                }

                // ── Atlas Loading Screen Dismissal ──────────────────────────────────
                // Inject a tiny script into every HTML response that calls __atlasReady().
                // This fires synchronously as the browser parses the page — no Puppeteer
                // events needed. Most reliable possible dismissal trigger.
                let responseBody: Buffer = Buffer.from(buffer);
                const contentTypeHeader = response.headers.get('content-type') || '';
                if (contentTypeHeader.includes('text/html')) {
                    let html = responseBody.toString('utf-8');
                    const dismissScript = '<script>try{if(typeof window.__atlasReady==="function")window.__atlasReady();}catch(e){}</script>';
                    
                    // Inject immediately after <body> tag to win the race against DOMContentLoaded
                    if (html.match(/<body[^>]*>/i)) {
                        html = html.replace(/(<body[^>]*>)/i, `$1${dismissScript}`);
                    } else {
                        html = dismissScript + html; 
                    }
                    responseBody = Buffer.from(html, 'utf-8');
                }

                await request.respond({
                    status: response.status,
                    contentType: response.headers.get('content-type') || undefined,
                    headers: resHeaders,
                    body: responseBody
                });
                return true;

            } catch (error) {
                const errorMsg = (error as Error).message || 'Unknown Error';
                const html = `
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; line-height: 1.6; color: #333; background: #fdf2f2; }
                        .container { max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #feb2b2; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                        h1 { color: #c53030; margin-top: 0; font-size: 24px; }
                        code { background: #fee2e2; padding: 2px 6px; border-radius: 4px; color: #9b2c2c; font-family: monospace; font-weight: bold; }
                        .suggestion { list-style: none; padding: 0; margin-top: 20px; border-top: 1px solid #eee; pt: 20px; }
                        .suggestion li { margin-bottom: 12px; padding-left: 24px; position: relative; }
                        .suggestion li:before { content: "→"; position: absolute; left: 0; color: #e53e3e; font-weight: bold; }
                        .footer { margin-top: 24px; font-size: 13px; color: #718096; }
                    </style>
                    <div class="container">
                        <h1>Atlas Proxy Error</h1>
                        <p><strong>Status:</strong> 502 Bad Gateway</p>
                        <p><strong>Cause:</strong> <code>${errorMsg}</code></p>
                        <p>Atlas reached the proxy layer but could not connect to your local application backend.</p>
                        
                        <ul class="suggestion">
                            <li><strong>Check your server</strong>: Is your app running on <code>localhost:${localPort}</code>?</li>
                            <li><strong>Verify config</strong>: Check if <code>atlas.config.json</code> needs an <code>appUrl</code> override.</li>
                            <li><strong>Port conflict</strong>: Ensure your dev server didn't pick a different port than expected.</li>
                        </ul>
                        <div class="footer">
                            Atlas Sandbox v1.1.2 Stability Layer
                        </div>
                    </div>
                `;
                await request.respond({
                    status: 502,
                    contentType: 'text/html',
                    body: html
                });
                return true;
            }
        }
        return false;
    }
}
