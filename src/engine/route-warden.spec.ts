/**
 * @jest-environment node
 */
import { StrictWarden } from '../../src/engine/route-warden';
import { HTTPRequest } from 'puppeteer-core';
import { URL } from 'url';
import { Violation } from '../../src/engine/state';
import { ProxyConfig } from '../../src/engine/proxy-engine';

describe('StrictWarden (Route Warden)', () => {
    let warden: StrictWarden;
    let mockRequest: jest.Mocked<HTTPRequest>;
    let mockOnViolation: jest.Mock;
    let mockOnLog: jest.Mock;

    beforeEach(() => {
        warden = new StrictWarden();
        mockRequest = {
            headers: jest.fn().mockReturnValue({}),
            resourceType: jest.fn().mockReturnValue('document'),
            isNavigationRequest: jest.fn().mockReturnValue(true),
        } as unknown as jest.Mocked<HTTPRequest>;

        mockOnViolation = jest.fn();
        mockOnLog = jest.fn();
    });

    test('should block requests when domain mismatch occurs in strict mode', () => {
        const url = new URL('http://malicious.com/');
        const config: ProxyConfig = {
            domain: 'localhost',
            localPort: 8080,
            appUrl: 'http://my-production-app.com',
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(true);
        expect(mockOnViolation).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Domain mismatch detected')
        }));
    });

    test('should merely warn when domain mismatch occurs without strict mode', () => {
        const url = new URL('http://malicious.com/');
        const config: ProxyConfig = {
            domain: 'localhost',
            localPort: 8080,
            appUrl: 'http://my-production-app.com',
            strictMode: false
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(false);
        expect(mockOnViolation).toHaveBeenCalled();
    });

    test('should block absolute URL access in subfolder deployment', () => {
        const url = new URL('http://my-app.com/dashboard'); // should be /my-app/dashboard
        const config: ProxyConfig = {
            domain: 'my-app.com',
            localPort: 8080,
            basePath: '/my-app/',
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(true);
        expect(mockOnViolation).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Direct URL access ignoring subfolder deployment')
        }));
    });

    test('should allow properly pathed subfolder deployed requests', () => {
        const url = new URL('http://my-app.com/roto-plast/dashboard');
        const config: ProxyConfig = {
            domain: 'my-app.com',
            localPort: 8080,
            basePath: '/roto-plast',
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(false);
        expect(mockOnViolation).not.toHaveBeenCalled();
    });

    test('should flag hardcoded localhost API calls in AJAX requests', () => {
        const url = new URL('http://localhost:8000/api/users');
        mockRequest.headers.mockReturnValue({ 'x-requested-with': 'XMLHttpRequest' });
        
        const config: ProxyConfig = {
            domain: 'my-production-app.com',
            localPort: 8000,
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(true);
        expect(mockOnViolation).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Hardcoded localhost API used in AJAX request')
        }));
    });

    test('should block access to unregistered routes when allowedRoutes is provided', () => {
        const url = new URL('http://localhost:8080/hidden-admin-panel');
        const config: ProxyConfig = {
            domain: 'localhost',
            localPort: 8080,
            allowedRoutes: ['/', '/login', '/dashboard'],
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(true);
        expect(mockOnViolation).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Inconsistent route access (Unregistered path)')
        }));
    });

    test('should allow access to registered patterned routes', () => {
        const url = new URL('http://localhost:8080/user/123/profile');
        const config: ProxyConfig = {
            domain: 'localhost',
            localPort: 8080,
            allowedRoutes: ['/', '/user/:id/profile'],
            strictMode: true
        };

        const shouldBlock = warden.checkRequest(mockRequest, url, config, mockOnViolation, mockOnLog);

        expect(shouldBlock).toBe(false);
        expect(mockOnViolation).not.toHaveBeenCalled();
    });
});
