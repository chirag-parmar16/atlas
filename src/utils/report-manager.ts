import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
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
    private videoDir: string;
    private videoPath: string;
    private localSource: string;

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
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // Simplified timestamp

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

    private async getReports(): Promise<Violation[]> {
        try {
            const content = await fs.readFile(this.reportPath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            return [];
        }
    }

    async logNavigation(url: string) {
        const reports = await this.getReports();
        const lastEntry = reports.length > 0 ? reports[reports.length - 1] : null;

        // Skip if same URL as last entry to avoid noise
        if (lastEntry && lastEntry.type === 'navigation' && lastEntry.url === url) return;

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

    private getLocalUrl(maskedUrl: string) {
        if (!this.localSource) return maskedUrl;
        try {
            const url = new URL(maskedUrl);
            // Replace the masked domain with localhost source
            return `${url.protocol}//${this.localSource}${url.pathname}${url.search}${url.hash}`;
        } catch (e) {
            return maskedUrl;
        }
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

    private translateViolation(v: Violation) {
        let title = v.message;
        let impact = "Potential impact on user experience.";
        let recommendation = "Review the affected resource and ensure it is accessible.";
        let icon = v.level === 2 ? '🔴' : '🟡';

        if (v.source === 'Network' && v.message.includes('404')) {
            title = `Broken Link: ${v.message.split(' on ')[1] || 'Unknown'}`;
            impact = "Users will encounter missing content or broken navigation, hurting trust.";
            recommendation = "Update the link to a valid URL or remove the broken reference.";
        } else if (v.source === 'Resource' && v.message.startsWith('Failed to load')) {
            const type = v.message.includes('IMG') ? 'Image' : 'Resource';
            title = `Missing ${type}: ${v.message.split(': ')[1] || 'Unknown'}`;
            impact = `Visual ${type} is missing, resulting in a broken or unprofessional layout.`;
            recommendation = "Check if the file exists on the server or if the path is correct.";
        } else if (v.source === 'Stability' && v.message.includes('Console Error')) {
            title = "Script Runtime Error";
            impact = "Certain page features or interactions might be completely broken.";
            recommendation = "Inspect the browser console to debug the JavaScript execution.";
        } else if (v.source === 'Security') {
            title = `Security Risk: ${v.message}`;
            impact = "Sensitive data could be exposed or the application could be vulnerable to attacks.";
            recommendation = "Apply standard security headers and sanitize all user inputs.";
            icon = '🛡️';
        }

        return { title, impact, recommendation, icon };
    }

    async generateMarkdownReport() {
        try {
            const entries = await this.getReports();
            if (entries.length === 0) {
                console.log('[Atlas] No entries found, skipping report generation.');
                return;
            }

            const violations = entries.filter(e => e.type === 'violation');
            const criticalCount = violations.filter(v => v.level === 2).length;
            const warningCount = violations.filter(v => v.level !== 2).length;

            let md = `# 📊 Atlas Audit Executive Summary\n\n`;
            md += `> **Session ID:** \`${path.basename(this.reportPath, '.json')}\`  \n`;
            md += `> **Date:** ${new Date().toLocaleString()}  \n\n`;

            md += `## 📈 Health Overview\n\n`;

            const healthScore = violations.length === 0 ? "Perfect" : (criticalCount > 0 ? "Attention Required" : "Stable");
            const healthIcon = violations.length === 0 ? "🟢" : (criticalCount > 0 ? "🔴" : "🟡");

            md += `| Metric | Status | Count |\n`;
            md += `| :--- | :--- | :--- |\n`;
            md += `| **Site Health** | ${healthIcon} ${healthScore} | - |\n`;
            md += `| **Critical Issues** | 🔴 High Impact | ${criticalCount} |\n`;
            md += `| **Warnings** | 🟡 Medium Impact | ${warningCount} |\n`;
            md += `| **Total Steps** | 🗺️ User Journey | ${entries.filter(e => e.type === 'navigation').length} |\n\n`;

            md += `--- \n\n`;

            // Group violations by the page they occurred on
            let journey: { url: string, timestamp: number, violations: Violation[] }[] = [];

            entries.forEach(entry => {
                if (entry.type === 'navigation') {
                    // Only push if URL is different from the last step or if it's the first step
                    if (journey.length === 0 || journey[journey.length - 1].url !== entry.url) {
                        journey.push({ url: entry.url, timestamp: entry.timestamp, violations: [] });
                    }
                } else if (entry.type === 'violation') {
                    if (journey.length > 0) {
                        journey[journey.length - 1].violations.push(entry);
                    } else {
                        journey.push({ url: entry.url, timestamp: entry.timestamp, violations: [entry] });
                    }
                }
            });

            md += `## 🗺️ User Journey Analysis\n\n`;
            journey.forEach((step, index) => {
                const stepTitle = step.url === 'http://test/' ? 'Home Page' : step.url;
                const localUrl = this.getLocalUrl(step.url);

                md += `### Step ${index + 1}: ${stepTitle}\n`;
                md += `🔗 **Masked:** [${step.url}](${step.url})  \n`;
                md += `🛠️ **Local:** [${localUrl}](${localUrl})  \n`;
                md += `⏱️ *Time: ${new Date(step.timestamp).toLocaleTimeString()}*\n\n`;

                if (step.violations.length === 0) {
                    md += `> **Status:** ✅ *No critical issues detected on this page.*\n\n`;
                } else {
                    // Deduplicate violations per step
                    const uniqueViolations = new Map<string, { v: Violation, count: number }>();
                    step.violations.forEach(v => {
                        const key = `${v.source}|${v.message}|${v.url}`;
                        const existing = uniqueViolations.get(key);
                        if (existing) {
                            existing.count++;
                        } else {
                            uniqueViolations.set(key, { v, count: 1 });
                        }
                    });

                    uniqueViolations.forEach(({ v, count }) => {
                        const { title, impact, recommendation, icon } = this.translateViolation(v);
                        const localViolationUrl = this.getLocalUrl(v.url);
                        const repeatLabel = count > 1 ? ` *(Seen ${count} times on this page)*` : '';

                        md += `#### ${icon} ${title}${repeatLabel}\n`;
                        md += `**Impact:** ${impact}  \n`;
                        md += `**Fix:** ${recommendation}\n`;
                        md += `**Sourced from:** \`${localViolationUrl}\`  \n\n`;

                        if (v.metadata && Object.keys(v.metadata).length > 0) {
                            md += `<details>\n<summary>View Technical Metadata</summary>\n\n`;
                            md += `\`\`\`json\n${JSON.stringify(v.metadata, null, 2)}\n\`\`\`\n`;
                            md += `</details>\n\n`;
                        }
                    });
                }
                md += `---\n\n`;
            });

            md += `\n*This report was automatically generated by Atlas Browser Orchestrator.*\n`;

            await fs.writeFile(this.mdReportPath, md, 'utf-8');
            console.log(`\n[Atlas] ✅ Premium Audit Report Generated: ${this.mdReportPath}`);
        } catch (error) {
            console.error('[Atlas] Failed to generate Markdown report:', error);
        }
    }
}
