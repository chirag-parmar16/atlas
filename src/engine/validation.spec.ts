import { 
    securityModeSchema, 
    stressConfigSchema, 
    headersSchema, 
    queryParamsSchema,
    saveVideoChunkSchema,
    finalizeVideoSchema
} from './validation';

describe('Validation Schemas', () => {
    describe('securityModeSchema', () => {
        it('should pass valid modes', () => {
            expect(securityModeSchema.parse('Standard')).toBe('Standard');
            expect(securityModeSchema.parse('Strict')).toBe('Strict');
            expect(securityModeSchema.parse('Offline')).toBe('Offline');
        });

        it('should fail invalid modes', () => {
            expect(() => securityModeSchema.parse('Insecure')).toThrow();
            expect(() => securityModeSchema.parse(123)).toThrow();
        });
    });

    describe('stressConfigSchema', () => {
        it('should pass valid config', () => {
            const valid = { enabled: true, errorRate: 50, latencyRate: 10, dropRate: 5 };
            expect(stressConfigSchema.parse(valid)).toEqual(valid);
        });

        it('should fail invalid ranges', () => {
            expect(() => stressConfigSchema.parse({ enabled: true, errorRate: 101, latencyRate: 0, dropRate: 0 })).toThrow();
            expect(() => stressConfigSchema.parse({ enabled: true, errorRate: -1, latencyRate: 0, dropRate: 0 })).toThrow();
        });

        it('should fail missing fields', () => {
            expect(() => stressConfigSchema.parse({ enabled: true, errorRate: 50 })).toThrow();
        });
    });

    describe('headersSchema', () => {
        it('should pass valid headers', () => {
            const headers = { 
                'content-type': 'application/json',
                'set-cookie': ['a=b', 'c=d'],
                'user-agent': 'Atlas'
            };
            expect(headersSchema.parse(headers)).toEqual(headers);
        });

        it('should fail non-string/non-array values', () => {
            expect(() => headersSchema.parse({ 'status': 200 })).toThrow();
        });
    });

    describe('queryParamsSchema', () => {
        it('should pass valid params', () => {
            const params = { q: 'search', page: '1' };
            expect(queryParamsSchema.parse(params)).toEqual(params);
        });

        it('should fail values exceeding length limit', () => {
            const longVal = 'a'.repeat(2049);
            expect(() => queryParamsSchema.parse({ key: longVal })).toThrow();
        });
    });

    describe('IPC Payload Schemas', () => {
        it('saveVideoChunkSchema should pass valid payload', () => {
            const buffer = new ArrayBuffer(8);
            const payload = { sessionId: 'test-123', buffer };
            expect(saveVideoChunkSchema.parse(payload)).toEqual(payload);
        });

        it('finalizeVideoSchema should pass valid payload', () => {
            const payload = { sessionId: 'test-123' };
            expect(finalizeVideoSchema.parse(payload)).toEqual(payload);
        });
    });
});
