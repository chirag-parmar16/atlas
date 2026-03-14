/**
 * Atlas Engine — Security Warden
 * 
 * Pure functions for PII scanning and CORS checking.
 * No Puppeteer dependency. No DOM access. No side effects.
 * 
 * Extracted from: src/network/network-manager.ts (scanForPII)
 */

export interface PIILeak {
    type: string;
    matches: string[];
}

/**
 * Validates if a string is a structurally correct JWT.
 * 1. Must have exactly 3 segments separated by '.'
 * 2. Payload (2nd segment) must be valid Base64
 * 3. Decoded payload must be valid JSON
 */
function isValidJWT(token: string): boolean {
    const segments = token.split('.');
    if (segments.length !== 3) return false;

    try {
        // Decode payload (segment[1])
        const payload = segments[1];
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        
        // Stricter check: Payload must be a non-null JSON OBJECT
        // This prevents version strings like "v1.0.1" (which parses to numbers) from being flagged.
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    } catch (e) {
        return false;
    }
}

export interface IdentityContext {
    email?: string;
    authorizedTokens?: string[];
}

/**
 * Scan text for PII (Personally Identifiable Information).
 * 
 * Detects: Credit Card numbers, Auth Tokens (Bearer/JWT/AWS keys).
 * Emails are only scanned on non-HTML responses (API data).
 * 
 * Zero Assumption: If IdentityContext is provided, we filter out "self-leaks"
 * (data that belongs to the current authorized user).
 * 
 * @param text - The text content to scan
 * @param isHtmlPage - If true, skip email detection (intentional display)
 * @param context - The authorized session context (Identity)
 * @returns Array of detected PII leaks with type and matches
 */
export function scanForPII(
    text: string, 
    isHtmlPage: boolean = false, 
    context: IdentityContext = {}
): PIILeak[] {
    const results: PIILeak[] = [];
    const patterns: Record<string, RegExp> = {
        CreditCard: /\b(?:\d[ -]*?){13,16}\b/g,
        AuthToken: /\b(?:Bearer|Token|JWT)\s+[a-zA-Z0-9._~+/-]{4,}\b|\bAKIA[0-9A-Z]{16}\b|\b[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/gi
    };

    // Only scan for emails on non-HTML responses (API data).
    if (!isHtmlPage) {
        patterns.Email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    }

    // Stage 1: Context Filtering
    const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
    
    let cleanText = text
        .replace(uuidRegex, '') // Strip UUIDs first
        .replace(/https?:\/\/[^\s"'<>]+/g, '')
        .replace(/(?:src|href|action|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, '');

    // Stage 2: Pattern Discovery
    for (const [type, regex] of Object.entries(patterns)) {
        const matches = Array.from(cleanText.matchAll(regex));
        if (matches.length > 0) {
            const filtered: string[] = [];

            for (const match of matches) {
                const m = match[0];
                const index = match.index || 0;

                // Zero Assumption: Identity Filter
                // If this is the user's own email, it's not a leak.
                if (type === 'Email' && context.email && m.toLowerCase() === context.email.toLowerCase()) {
                    continue;
                }

                // If this is an authorized token used in the request, it's not a leak (it's a mirror).
                if (type === 'AuthToken' && context.authorizedTokens?.some(t => m.includes(t) || t.includes(m))) {
                    continue;
                }

                // Boilerplate Noise Reduction
                if (['bearer', 'token', 'jwt'].includes(m.toLowerCase())) {
                    const contextStr = cleanText.substring(index + m.length, index + m.length + 15);
                    const isBoilerplate = contextStr.includes('${') || contextStr.includes('+') || 
                                        contextStr.includes('`') || contextStr.includes('template') ||
                                        contextStr.includes('\')') || contextStr.includes('\']') || 
                                        contextStr.includes('",') || contextStr.includes("\',");
                    
                    if (isBoilerplate || contextStr.trim().length === 0) {
                        continue;
                    }
                }

                // Stage 3: Structural Validation
                if (type === 'CreditCard') {
                    if (m.replace(/[ -]/g, '').length >= 13) {
                        filtered.push(m);
                    }
                } else if (type === 'AuthToken') {
                    const isKeywordPrefixed = m.toLowerCase().startsWith('bearer') || 
                                            m.toLowerCase().startsWith('token') || 
                                            m.toLowerCase().startsWith('jwt');
                    
                    if (m.includes('.') && !isKeywordPrefixed) {
                        // Strict validation ONLY for raw x.y.z patterns
                        if (isValidJWT(m)) {
                            filtered.push(m);
                        }
                    } else {
                        // Keyword-prefixed tokens or AWS keys are kept as-is
                        filtered.push(m);
                    }
                } else {
                    filtered.push(m);
                }
            }

            if (filtered.length > 0) {
                results.push({ type, matches: filtered });
            }
        }
    }

    return results;
}

/**
 * Mask sensitive PII data for safe logging.
 * Shows first 4 and last 4 characters, masks the rest.
 * 
 * Fix for audit finding: "Sensitive Data Exposure in Audit Logs"
 */
export function maskPII(value: string): string {
    if (value.length > 8) {
        return value.substring(0, 4) + '****' + value.substring(value.length - 4);
    }
    return '****';
}

/**
 * Check if a CORS header is insecure (wildcard origin).
 * 
 * @returns true if the CORS header is insecure
 */
export function isInsecureCORS(accessControlAllowOrigin: string | null | undefined): boolean {
    if (!accessControlAllowOrigin) return false;
    return accessControlAllowOrigin === '*' || accessControlAllowOrigin === 'null';
}
