import { scanForPII, maskPII, isInsecureCORS, PIILeak } from './security-warden';

describe('SecurityWarden', () => {
    describe('scanForPII', () => {
        it('should detect credit card numbers', () => {
            const text = "Payment processed with card: 4111 1111 1111 1111.";
            const results = scanForPII(text);
            expect(results.length).toBe(1);
            expect(results[0].type).toBe('CreditCard');
            expect(results[0].matches[0]).toBe('4111 1111 1111 1111');
        });

        it('should detect auth tokens', () => {
            const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWI...";
            const results = scanForPII(text);
            expect(results.length).toBe(1);
            expect(results[0].type).toBe('AuthToken');
        });

        it('should detect emails in non-HTML content', () => {
            const jsonText = '{"user": "test@example.com"}';
            const results = scanForPII(jsonText, false);
            const emailLeak = results.find((r: PIILeak) => r.type === 'Email');
            expect(emailLeak).toBeDefined();
            expect(emailLeak?.matches[0]).toBe('test@example.com');
        });

        it('should ignore emails in HTML content to prevent noise', () => {
            const htmlText = '<footer>Contact us at support@example.com</footer>';
            const results = scanForPII(htmlText, true);
            const emailLeak = results.find((r: PIILeak) => r.type === 'Email');
            expect(emailLeak).toBeUndefined();
        });

        it('should strip URLs to prevent false positive numbers', () => {
            const text = 'Check out this https://site.com/photo-12345678901234.img';
            const results = scanForPII(text);
            expect(results).toHaveLength(0);
        });

        it('should ignore UUIDs to prevent AuthToken false positives', () => {
            const text = "Request ID: 550e8400-e29b-41d4-a716-446655440000";
            const results = scanForPII(text);
            expect(results).toHaveLength(0);
        });

        it('should validate JWT structure (3 segments)', () => {
            const invalidJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"; // Missing signature
            const results = scanForPII(invalidJwt);
            expect(results).toHaveLength(0);
        });

        it('should accept structurally valid JWTs', () => {
            const validJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
            const results = scanForPII(validJwt);
            expect(results.length).toBe(1);
            expect(results[0].type).toBe('AuthToken');
        });

        it('should NOT flag version strings or non-object dots as JWTs', () => {
            const version = "Project Version v1.0.1 and file.test.js";
            const results = scanForPII(version);
            expect(results.length).toBe(0);
        });

        it('should ignore source code boilerplate (template literals/concats)', () => {
            const boilerplate = "headers: { 'Authorization': `Bearer ${token}` }";
            const results = scanForPII(boilerplate);
            expect(results.length).toBe(0);

            const concat = "const header = 'Bearer ' + secret;";
            const results2 = scanForPII(concat);
            expect(results2.length).toBe(0);

            const jsCall = "localStorage.getItem('token')";
            const results3 = scanForPII(jsCall);
            expect(results3.length).toBe(0);

            const jsArr = "config['Bearer'] = true;";
            const results4 = scanForPII(jsArr);
            expect(results4.length).toBe(0);
        });

        it('should NOT flag the user\'s own email if IdentityContext is provided', () => {
            const context = { email: 'admin@example.com' };
            const text = 'Response: {"email": "admin@example.com", "other": "victim@hacker.com"}';
            
            const results = scanForPII(text, false, context);
            const emails = results.find(r => r.type === 'Email')?.matches || [];
            
            expect(emails).not.toContain('admin@example.com');
            expect(emails).toContain('victim@hacker.com');
        });

        it('should NOT flag authorized tokens if they match IdentityContext', () => {
            const context = { authorizedTokens: ['my-secret-token'] };
            const text = 'Mirror: Bearer my-secret-token, Leak: Bearer someone-elses-token';
            
            const results = scanForPII(text, false, context);
            const tokens = results.find(r => r.type === 'AuthToken')?.matches || [];
            
            // Check that my-secret-token is filtered out, but others remain
            expect(tokens.some(t => t.includes('my-secret-token'))).toBe(false);
            expect(tokens.some(t => t.includes('someone-elses-token'))).toBe(true);
        });
    });

    describe('maskPII', () => {
        it('should mask sensitive data, keeping first 4 and last 4 characters', () => {
            const cc = '4111222233334444';
            expect(maskPII(cc)).toBe('4111****4444');
        });

        it('should just return **** for short strings', () => {
            expect(maskPII('12345')).toBe('****');
        });
    });

    describe('isInsecureCORS', () => {
        it('should flag wildcard domains as insecure', () => {
            expect(isInsecureCORS('*')).toBe(true);
        });

        it('should flag "null" domains as insecure', () => {
            expect(isInsecureCORS('null')).toBe(true);
        });

        it('should allow valid strict domains', () => {
            expect(isInsecureCORS('https://my-secure-site.com')).toBe(false);
        });

        it('should return false for missing headers', () => {
            expect(isInsecureCORS(undefined)).toBe(false);
            expect(isInsecureCORS(null)).toBe(false);
        });
    });
});
