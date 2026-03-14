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
        JSON.parse(decoded);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Scan text for PII (Personally Identifiable Information).
 * 
 * Detects: Credit Card numbers, Auth Tokens (Bearer/JWT/AWS keys).
 * Emails are only scanned on non-HTML responses (API data) since
 * HTML pages commonly display intentional contact emails.
 * 
 * @param text - The text content to scan
 * @param isHtmlPage - If true, skip email detection (intentional display)
 * @returns Array of detected PII leaks with type and matches
 */
export function scanForPII(text: string, isHtmlPage: boolean = false): PIILeak[] {
    const results: PIILeak[] = [];
    const patterns: Record<string, RegExp> = {
        CreditCard: /\b(?:\d[ -]*?){13,16}\b/g,
        AuthToken: /\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16}|[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/gi
    };

    // Only scan for emails on non-HTML responses (API data).
    if (!isHtmlPage) {
        patterns.Email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    }

    // Stage 1: Context Filtering
    // Remove UUIDs, URLs, and common HTML attributes to prevent false positives
    const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
    
    let cleanText = text
        .replace(uuidRegex, '') // Strip UUIDs first
        .replace(/https?:\/\/[^\s"'<>]+/g, '')
        .replace(/(?:src|href|action|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, '');

    // Stage 2: Pattern Discovery
    for (const [type, regex] of Object.entries(patterns)) {
        const matches = cleanText.match(regex);
        if (matches) {
            let filtered: string[] = matches;

            // Stage 3: Structural Validation
            if (type === 'CreditCard') {
                filtered = matches.filter(m => m.replace(/[ -]/g, '').length >= 13);
            } else if (type === 'AuthToken') {
                filtered = matches.filter(m => {
                    // If it's a long string that looks like a JWT, validate it
                    if (m.includes('.')) {
                        return isValidJWT(m);
                    }
                    // For short tokens like "Bearer" or "Token" alone, we keep them as potential matches
                    // but usually they are part of a larger string. If the regex found them, 
                    // we allow them unless they are obviously not tokens.
                    return true;
                });
            }

            if (filtered.length > 0) results.push({ type, matches: filtered });
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
