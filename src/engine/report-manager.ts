import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { Violation } from './state';
import { buildTreeReport, generateMarkdown } from './report-utils';

export class ReportManager {
    private reportPath: string;
    private mdReportPath: string;
    private videoDir: string;
    private videoPath: string;
    private localSource: string;

    // In-memory log — prevents race conditions from concurrent read-modify-write
    private entries: Violation[] = [];
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(projectPath: string, localSource?: string) {
        this.localSource = localSource || 'localhost';
        const resolvedPath = path.resolve(projectPath);
        const reportBase = path.join(resolvedPath, 'atlas-reports');
        const jsonDir = path.join(reportBase, 'json');
        const mdDir = path.join(reportBase, 'markdown');
        this.videoDir = path.join(reportBase, 'videos');

        // Ensure directories exist
        if (!existsSync(reportBase)) mkdirSync(reportBase, { recursive: true });
        if (!existsSync(jsonDir)) mkdirSync(jsonDir, { recursive: true });
        if (!existsSync(mdDir)) mkdirSync(mdDir, { recursive: true });

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

        this.reportPath = path.join(jsonDir, `report-${timestamp}.json`);
        this.mdReportPath = path.join(mdDir, `audit-${timestamp}.md`);
        this.videoPath = path.join(this.videoDir, `recording-${timestamp}.mp4`);

        console.log(`[Atlas] Structured reports will be saved in: atlas-reports/`);
    }

    public getReportPaths() {
        return {
            json: this.reportPath,
            markdown: this.mdReportPath,
            video: this.videoPath,
            videoDir: this.videoDir
        };
    }

    public getViolations(): Violation[] {
        return this.entries;
    }

    private async getReports(): Promise<Violation[]> {
        if (this.entries.length > 0) return this.entries;
        try {
            const content = await fs.readFile(this.reportPath, 'utf-8');
            const parsed = JSON.parse(content);
            if (parsed.journey && Array.isArray(parsed.journey)) {
                const flat: Violation[] = [];
                parsed.journey.forEach((page: { url: string; timestamp: number; violations?: { source: string; message: string; level?: number; timestamp: number; resourceUrl?: string; metadata?: Record<string, unknown> }[]; subPages?: { url: string; timestamp: number }[] }) => {
                    flat.push({ type: 'navigation', source: 'Browser', message: `Visited: ${page.url}`, timestamp: page.timestamp, url: page.url });
                    page.violations?.forEach((v) => {
                        flat.push({ type: 'violation', source: v.source, message: v.message, level: v.level, timestamp: v.timestamp, url: v.resourceUrl || page.url, metadata: v.metadata });
                    });
                    page.subPages?.forEach((sp) => {
                        flat.push({ type: 'navigation', source: 'Browser', message: `Visited: ${sp.url}`, timestamp: sp.timestamp, url: sp.url });
                    });
                });
                this.entries = flat;
            } else if (Array.isArray(parsed)) {
                this.entries = parsed;
            }
            return this.entries;
        } catch (e) {
            return this.entries;
        }
    }

    async logNavigation(url: string, metrics?: { loadTime: number; storage: number }) {
        const lastEntry = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
        if (lastEntry && lastEntry.type === 'navigation' && lastEntry.url === url && !metrics) return;

        if (lastEntry && lastEntry.type === 'navigation' && lastEntry.url === url && metrics) {
            lastEntry.metrics = metrics;
            this.scheduleFlush();
            return;
        }

        this.entries.push({
            type: 'navigation',
            source: 'Browser',
            message: `Visited: ${url}`,
            timestamp: Date.now(),
            url,
            metrics
        });
        this.scheduleFlush();
    }

    async logViolation(violation: Omit<Violation, 'type'>) {
        this.entries.push({ ...violation, type: 'violation' });
        this.scheduleFlush();
    }

    private scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushToDisk().catch(() => { });
        }, 2000);
    }

    async flushToDisk() {
        try {
            const result = buildTreeReport(this.entries, this.localSource);
            const structured = {
                session: {
                    id: path.basename(this.reportPath, '.json'),
                    startTime: this.entries.length > 0 ? new Date(this.entries[0].timestamp).toISOString() : new Date().toISOString(),
                    endTime: new Date().toISOString(),
                    date: new Date().toLocaleString(),
                    totalPages: result.journey.length,
                    totalSteps: this.entries.filter(e => e.type === 'navigation').length
                },
                summary: result.summary,
                journey: result.journey
            };
            await fs.writeFile(this.reportPath, JSON.stringify(structured, null, 2), 'utf-8');
        } catch (error) {
            console.error('[Atlas] Failed to flush log to disk:', error);
        }
    }

    async generateMarkdownReport() {
        try {
            const entries = await this.getReports();
            if (entries.length === 0) return;

            const md = generateMarkdown(entries, this.localSource, path.basename(this.reportPath, '.json'));
            await fs.writeFile(this.mdReportPath, md, 'utf-8');
            console.log(`\n[Atlas] ✅ Premium Audit Report Generated: ${this.mdReportPath}`);
        } catch (error) {
            console.error('[Atlas] Failed to generate Markdown report:', error);
        }
    }
}
