import { ChaosEngine } from './chaos-engine';
import { ChaosConfig } from './state';
import { HTTPRequest } from 'puppeteer-core';

describe('ChaosEngine', () => {
    let chaosEngine: ChaosEngine;
    let mockRequest: jest.Mocked<HTTPRequest>;
    let mockOnViolation: jest.Mock;

    beforeEach(() => {
        chaosEngine = new ChaosEngine();
        mockRequest = {
            url: jest.fn().mockReturnValue('http://example.com/api'),
            abort: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<HTTPRequest>;
        mockOnViolation = jest.fn();
    });

    it('should be disabled by default', async () => {
        const handled = await chaosEngine.inject(mockRequest, mockOnViolation);
        expect(handled).toBe(false);
        expect(mockRequest.abort).not.toHaveBeenCalled();
    });

    it('should update configuration correctly', () => {
        const newConfig: ChaosConfig = { enabled: true, errorRate: 50, latencyRate: 10, dropRate: 5 };
        chaosEngine.setConfig(newConfig);
        expect(chaosEngine.getConfig()).toEqual(newConfig);
    });

    it('should abort request when dropRate is 100', async () => {
        chaosEngine.setConfig({ enabled: true, dropRate: 100, errorRate: 0, latencyRate: 0 });
        const handled = await chaosEngine.inject(mockRequest, mockOnViolation);
        expect(handled).toBe(true);
        expect(mockRequest.abort).toHaveBeenCalledWith('failed');
    });

    it('should inject 500 error when errorRate is 100', async () => {
        chaosEngine.setConfig({ enabled: true, dropRate: 0, errorRate: 100, latencyRate: 0 });
        const handled = await chaosEngine.inject(mockRequest, mockOnViolation);
        expect(handled).toBe(true);
        expect(mockRequest.respond).toHaveBeenCalledWith(expect.objectContaining({
            status: 500
        }));
        expect(mockOnViolation).toHaveBeenCalled();
    });

    it('should delay request when latencyRate is 100', async () => {
        chaosEngine.setConfig({ enabled: true, dropRate: 0, errorRate: 0, latencyRate: 100 });
        
        const startTime = Date.now();
        const handled = await chaosEngine.inject(mockRequest, mockOnViolation);
        const duration = Date.now() - startTime;

        expect(handled).toBe(false);
        expect(duration).toBeGreaterThanOrEqual(2000);
    });
});
