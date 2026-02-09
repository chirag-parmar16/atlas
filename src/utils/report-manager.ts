import fs from 'fs/promises';
import path from 'path';

export interface Violation {
    type: 'violation' | 'navigation';
    source: string;
    message: string;
    level?: number;
    timestamp: number;
    url: string;
    metadata?: any;
}

export class ReportManager {
    private reportPath: string;
    private mdReportPath: string;

    constructor(projectPath: string) {
        const resolvedPath = path.resolve(projectPath);
        this.reportPath = path.join(resolvedPath, 'atlas-report.json');
        this.mdReportPath = path.join(resolvedPath, 'atlas-audit-report.md');
        console.log(`[Atlas] Reporting to: ${this.reportPath}`);
    }

    private async getReports(): Promise<Violation[]> {
        try {
            const content = await fs.readFile(this.reportPath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            return [];
        }
    }

    async logNavigation(url: string) {
        await this.log({
            type: 'navigation',
            source: 'Browser',
            message: `Visited: ${url}`,
            timestamp: Date.now(),
            url
        });
    }

    async logViolation(violation: Omit<Violation, 'type'>) {
        await this.log({ ...violation, type: 'violation' });
    }

    private async log(entry: Violation) {
        try {
            const reports = await this.getReports();
            reports.push(entry);
            await fs.writeFile(this.reportPath, JSON.stringify(reports, null, 2), 'utf-8');
        } catch (error) {
            console.error('[Atlas] Failed to log to JSON:', error);
        }
    }

    async generateMarkdownReport() {
        try {
            const entries = await this.getReports();
            if (entries.length === 0) {
                console.log('[Atlas] No entries found, skipping report generation.');
                return;
            }

            let md = `# 📊 Atlas Audit Report\n`;
            md += `**Date:** ${new Date().toLocaleString()}\n`;
            md += `**Total Events:** ${entries.length}\n\n`;
            md += `--- \n\n`;

            // Group violations by the page they occurred on
            let journey: { url: string, timestamp: number, violations: Violation[] }[] = [];

            entries.forEach(entry => {
                if (entry.type === 'navigation') {
                    journey.push({ url: entry.url, timestamp: entry.timestamp, violations: [] });
                } else if (entry.type === 'violation') {
                    // Add to the MOST RECENT navigation point
                    if (journey.length > 0) {
                        journey[journey.length - 1].violations.push(entry);
                    } else {
                        // Edge case: violation before first explicit navigation log
                        journey.push({ url: entry.url, timestamp: entry.timestamp, violations: [entry] });
                    }
                }
            });

            md += `## 🗺️ User Journey\n\n`;
            journey.forEach((step, index) => {
                md += `### Step ${index + 1}: ${step.url}\n`;
                md += `> Time: ${new Date(step.timestamp).toLocaleTimeString()}\n\n`;

                if (step.violations.length === 0) {
                    md += `✅ *No issues detected on this step.*\n\n`;
                } else {
                    step.violations.forEach(v => {
                        const icon = v.level === 2 ? '🔴' : '🟡';
                        md += `#### ${icon} [${v.source}] ${v.message}\n`;
                        md += `\`\`\`json\n${JSON.stringify(v.metadata || {}, null, 2)}\n\`\`\`\n\n`;
                    });
                }
                md += `---\n\n`;
            });

            await fs.writeFile(this.mdReportPath, md, 'utf-8');
            console.log(`\n[Atlas] ✅ Audit Report Generated: ${this.mdReportPath}`);
        } catch (error) {
            console.error('[Atlas] Failed to generate Markdown report:', error);
        }
    }
}
