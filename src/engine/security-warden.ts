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
        AuthToken: /\b(?:Bearer|Token|JWT|AKIA[0-9A-Z]{16})\b/gi
    };

    // Only scan for emails on non-HTML responses (API data).
    if (!isHtmlPage) {
        patterns.Email = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    }

    // Strip URLs and HTML attributes to prevent false positives from number
    // sequences in URLs (e.g., Unsplash photo IDs like "photo-1581578731548")
    let cleanText = text
        .replace(/https?:\/\/[^\s"'<>]+/g, '')
        .replace(/(?:src|href|action|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, '');

    for (const [type, regex] of Object.entries(patterns)) {
        const matches = cleanText.match(regex);
        if (matches) {
            const filtered = type === 'CreditCard'
                ? matches.filter(m => m.replace(/[ -]/g, '').length >= 13)
                : matches;

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
