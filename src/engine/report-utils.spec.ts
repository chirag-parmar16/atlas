import { generateMarkdown } from './report-utils';
import { Violation } from './state';

describe('Report Snapshots', () => {
    const localSource = 'localhost:3000';
    const reportId = 'test-report-123';
    
    // Mock Date globally to stabilize snapshots
    const fixedDate = new Date('2026-03-17T12:00:00Z');
    fixedDate.toLocaleString = () => '17/03/2026, 5:30:00 pm';
    fixedDate.toLocaleTimeString = () => '5:30:00 pm';
    
    const originalDate = global.Date;

    beforeAll(() => {
        // @ts-ignore
        global.Date = class extends originalDate {
            constructor() {
                super();
                return fixedDate;
            }
        };
    });

    afterAll(() => {
        global.Date = originalDate;
    });

    it('should generate a consistent markdown report for standard violations', () => {
        const violations: Violation[] = [
            {
                type: 'navigation',
                source: 'Browser',
                message: 'Visited: http://example.com/',
                timestamp: 1625097600000,
                url: 'http://example.com/',
                metrics: { loadTime: 450, storage: 120 }
            },
            {
                type: 'violation',
                source: 'Network',
                message: 'HTTP 404 on /missing-image.png',
                level: 1,
                timestamp: 1625097601000,
                url: 'http://example.com/missing-image.png'
            },
            {
                type: 'violation',
                source: 'Security Warden',
                message: 'PII Leak(Email) detected in /profile: user***@example.com',
                level: 2,
                timestamp: 1625097602000,
                url: 'http://example.com/profile'
            }
        ];

        const markdown = generateMarkdown(violations, localSource, reportId);
        expect(markdown).toMatchSnapshot();
    });

    it('should generate a simple report with no violations', () => {
        const violations: Violation[] = [
            {
                type: 'navigation',
                source: 'Browser',
                message: 'Visited: http://example.com/',
                timestamp: 1625097600000,
                url: 'http://example.com/'
            }
        ];

        const markdown = generateMarkdown(violations, localSource, reportId);
        expect(markdown).toMatchSnapshot();
    });
});
