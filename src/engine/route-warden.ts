import { HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { Violation } from './state';
import { ProxyConfig } from './proxy-engine';

export class StrictWarden {
    
    public checkRequest(
        request: HTTPRequest, 
        url: URL, 
        config: ProxyConfig, 
        onViolation: (v: Violation) => void,
        onLog: (msg: string) => void
    ): boolean {
        // Return true if the request should be BLOCKED (when strict mode is on).
        
        let shouldBlock = false;
        const isStrict = config.strictMode === true;
        const isAjax = request.headers()['x-requested-with'] === 'XMLHttpRequest' || 
                       request.headers()['accept']?.includes('application/json') ||
                       request.resourceType() === 'fetch' || 
                       request.resourceType() === 'xhr';

        const recordViolation = (msg: string, level: number, suggestFix: string) => {
            const finalMsg = `${msg} | Suggested fix: ${suggestFix}`;
            onViolation({
                source: 'Route Warden',
                message: finalMsg,
                level,
                timestamp: Date.now(),
                url: url.href
            });
            onLog(`[Route Warden] ${finalMsg}`);
            if (isStrict) {
                shouldBlock = true;
            }
        };

        // 1. Domain Validation
        if (config.appUrl) {
            try {
                const appUrlObj = new URL(config.appUrl);
                if (url.hostname !== appUrlObj.hostname) {
                    recordViolation(
                        `Domain mismatch detected (Requested: ${url.hostname}, Expected: ${appUrlObj.hostname})`,
                        2,
                        `Configure your proxy domain to match APP_URL, or ensure valid CNAME.`
                    );
                }
            } catch (e) {
                // Ignore invalid URL
            }
        }

        // 2 & 4. Subfolder Awareness & AJAX Request Handling
        const basePath = config.basePath && config.basePath.startsWith('/') ? config.basePath : (config.basePath ? '/' + config.basePath : '/');
        const isRootDeployment = basePath === '/';
        
        if (!isRootDeployment) {
            if (!url.pathname.startsWith(basePath)) {
                if (isAjax) {
                     recordViolation(
                        `Absolute URL used in subfolder deployment for AJAX request`,
                        2,
                        `Use route() helper or dynamically prepend the basePath.`
                    );
                } else if (request.isNavigationRequest()) {
                    recordViolation(
                        `Direct URL access ignoring subfolder deployment`,
                        2,
                        `Use Route generic helper or proper subfolder anchor paths.`
                    );
                } else {
                    recordViolation(
                        `Asset requested with absolute path in subfolder deployment`,
                        1,
                        `Ensure assets use relative paths to prevent 404s.`
                    );
                }
            }
        } else if (isAjax && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
             if (config.domain && config.domain !== 'localhost' && config.domain !== '127.0.0.1') {
                 recordViolation(
                    `Hardcoded localhost API used in AJAX request`,
                    2,
                    `Avoid hardcoding localhost. Rely on relative paths to prevent CORS issues in production.`
                );
             }
        }

        // 3. Route Integrity Check
        if (config.allowedRoutes && config.allowedRoutes.length > 0) {
            const checkPath = url.pathname;
            let matched = false;
            for (const pattern of config.allowedRoutes) {
                if (this.matchRoute(pattern, checkPath)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                recordViolation(
                    `Inconsistent route access (Unregistered path)`,
                    2,
                    `Direct URL access may fail in production. Use explicit route() names or add to manifest.`
                );
            }
        }

        return shouldBlock;
    }

    private matchRoute(pattern: string, path: string): boolean {
        if (pattern === path) return true;
        if (pattern === '*' || pattern === '/*') return true;
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            if (path.startsWith(prefix)) return true;
        }
        
        // Handle parameter patterns like /user/:id or /user/{id}
        const regexPattern = pattern
            .replace(/\/[?:{][^\/{}]+}/g, '/[^/]+')
            .replace(/\/:[^\/]+/g, '/[^/]+')
            .replace(/\*/g, '.*');
            
        try {
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        } catch {
            return false;
        }
    }
}
