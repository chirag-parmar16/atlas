import { ReportManager } from './report-manager';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';

jest.mock('fs/promises');
jest.mock('fs');

describe('ReportManager', () => {
    let reportManager: ReportManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock fs basic behavior for constructor
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

        // Turn off real timers so flush doesn't hang test or run unexpectedly
        jest.useFakeTimers();

        reportManager = new ReportManager('/mock/project', 'test-local');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should initialize and create correctly named report paths', () => {
        const paths = reportManager.getReportPaths();
        expect(paths.json).toContain('report-');
        expect(paths.markdown).toContain('audit-');
        expect(paths.video).toContain('recording-');
    });

    it('should log a new violation to memory', async () => {
        await reportManager.logViolation({
            source: 'Security',
            message: 'Insecure CORS',
            level: 2,
            timestamp: 1000,
            url: 'http://test/api'
        });

        const violations = reportManager.getViolations();
        expect(violations.length).toBe(1);
        expect(violations[0]).toEqual({
            type: 'violation',
            source: 'Security',
            message: 'Insecure CORS',
            level: 2,
            timestamp: 1000,
            url: 'http://test/api'
        });
    });

    it('should schedule a flush when a violation is logged', async () => {
        const writeFileSpy = (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);

        await reportManager.logViolation({
            source: 'Network',
            message: '404 Error',
            level: 1,
            timestamp: 1000,
            url: 'http://test/404'
        });

        // Jump forward 2 seconds to let the flushTimer trigger
        jest.advanceTimersByTime(2000);

        // Wait for any microtasks (like the async disk flush) to clear
        await Promise.resolve();

        expect(writeFileSpy).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate recurring navigation logs without metrics', async () => {
        await reportManager.logNavigation('http://test/page1');
        await reportManager.logNavigation('http://test/page1'); // Should be ignored

        const violations = reportManager.getViolations();
        expect(violations.length).toBe(1);
        expect(violations[0].url).toBe('http://test/page1');
    });

    it('should update navigation entry if new metrics are provided', async () => {
        await reportManager.logNavigation('http://test/page1');
        await reportManager.logNavigation('http://test/page1', { loadTime: 120, storage: 5 });

        const violations = reportManager.getViolations();
        expect(violations.length).toBe(1);
        expect(violations[0].metrics).toEqual({ loadTime: 120, storage: 5 });
    });
});
