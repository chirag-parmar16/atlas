import { Violation } from './state';
import { scanForPII, maskPII, isInsecureCORS, PIILeak } from './security-warden';

export class SecurityScanner {
    private mode: 'Standard' | 'Strict' | 'Offline' = 'Standard';

    constructor(initialMode?: 'Standard' | 'Strict' | 'Offline') {
        if (initialMode) this.mode = initialMode;
    }

    public setMode(mode: 'Standard' | 'Strict' | 'Offline'): void {
        this.mode = mode;
    }

    public getMode(): 'Standard' | 'Strict' | 'Offline' {
        return this.mode;
    }

    /**
     * Checks if a request should be blocked based on security mode.
     */
    public shouldBlockWebSocket(): boolean {
        return this.mode === 'Offline';
    }

    /**
     * Scans a response body for PII leaks.
     */
    public scanResponse(
        urlPath: string,
        fullUrl: string,
        body: string,
        contentType: string,
        isHtml: boolean,
        isSamePageNav: boolean,
        onViolation: (v: Violation) => void,
        onLog: (msg: string) => void
    ): void {
        if (body.length > 1000000) return; // Skip very large files

        const leaks = isSamePageNav ? [] : scanForPII(body, isHtml);

        if (leaks.length > 0) {
            onLog(`[Atlas Security] 🎯 Found ${leaks.length} PII leaks in ${urlPath} (${contentType})`);

            leaks.forEach((leak: PIILeak) => {
                const maskedMatches = leak.matches.map((m: string) => maskPII(m));
                onViolation({
                    source: 'Security Warden',
                    message: `PII Leak(${leak.type}) detected in ${urlPath}: ${maskedMatches.join(', ')}`,
                    level: 2,
                    timestamp: Date.now(),
                    url: fullUrl
                });
            });
        }
    }

    /**
     * Checks for insecure CORS headers.
     * @returns true if the header was blocked/removed.
     */
    public checkCORS(
        urlPath: string,
        fullUrl: string,
        resHeaders: Record<string, string | string[]>,
        onViolation: (v: Violation) => void
    ): boolean {
        if (this.mode !== 'Strict') return false;

        const acao = resHeaders['access-control-allow-origin'];
        if (isInsecureCORS(acao as string | undefined)) {
            delete resHeaders['access-control-allow-origin'];
            onViolation({
                source: 'Security Warden',
                message: `Blocked insecure CORS wildcard(*) on ${urlPath}`,
                level: 2,
                timestamp: Date.now(),
                url: fullUrl
            });
            return true;
        }
        return false;
    }
}
