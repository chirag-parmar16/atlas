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

    // In-memory log — prevents race conditions from concurrent read-modify-write
    private entries: Violation[] = [];
    private flushTimer: any = null;

    private async getReports(): Promise<Violation[]> {
        // If we have in-memory entries, return those (source of truth)
        if (this.entries.length > 0) return this.entries;
        // Otherwise read from disk (cold start)
        try {
            const content = await fs.readFile(this.reportPath, 'utf-8');
            const parsed = JSON.parse(content);
            // Handle tree format (new) — reconstruct flat entries
            if (parsed.journey && Array.isArray(parsed.journey)) {
                const flat: Violation[] = [];
                parsed.journey.forEach((page: any) => {
                    flat.push({ type: 'navigation', source: 'Browser', message: `Visited: ${page.url}`, timestamp: page.timestamp, url: page.url });
                    page.violations?.forEach((v: any) => {
                        flat.push({ type: 'violation', source: v.source, message: v.message, level: v.level, timestamp: v.timestamp, url: v.resourceUrl || page.url, metadata: v.metadata });
                    });
                    page.subPages?.forEach((sp: any) => {
                        flat.push({ type: 'navigation', source: 'Browser', message: `Visited: ${sp.url}`, timestamp: sp.timestamp, url: sp.url });
                    });
                });
                this.entries = flat;
            } else if (Array.isArray(parsed)) {
                // Handle flat format (legacy)
                this.entries = parsed;
            }
            return this.entries;
        } catch (e) {
            return this.entries;
        }
    }

    async logNavigation(url: string) {
        const lastEntry = this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;

        // Skip if same URL as last entry to avoid noise
        if (lastEntry && lastEntry.type === 'navigation' && lastEntry.url === url) return;

        this.entries.push({
            type: 'navigation',
            source: 'Browser',
            message: `Visited: ${url}`,
            timestamp: Date.now(),
            url
        });
        this.scheduleFlush();
    }

    async logViolation(violation: Omit<Violation, 'type'>) {
        this.entries.push({ ...violation, type: 'violation' });
        this.scheduleFlush();
    }

    private scheduleFlush() {
        if (this.flushTimer) return; // Already scheduled
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushToDisk().catch(() => { });
        }, 2000);
    }

    async flushToDisk() {
        try {
            const structured = this.buildTreeReport();
            await fs.writeFile(this.reportPath, JSON.stringify(structured, null, 2), 'utf-8');
        } catch (error) {
            console.error('[Atlas] Failed to flush log to disk:', error);
        }
    }

    private normalizePath(urlStr: string): string {
        try {
            const u = new URL(urlStr);
            return u.pathname.replace(/\/(index\.html?)?$/, '/');
        } catch { return urlStr; }
    }

    private buildTreeReport() {
        const navigations = this.entries.filter(e => e.type === 'navigation');
        const firstTs = this.entries.length > 0 ? this.entries[0].timestamp : Date.now();
        const lastTs = this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : Date.now();

        // Build journey: group entries by navigation steps
        const pages: {
            step: number;
            url: string;
            localUrl: string;
            timestamp: number;
            time: string;
            violations: any[];
            subPages: { url: string; timestamp: number; time: string }[];
        }[] = [];

        // Track which normalized paths we've already created a page for
        const pathToPageIndex = new Map<string, number>();

        this.entries.forEach(entry => {
            if (entry.type === 'navigation') {
                const norm = this.normalizePath(entry.url);
                const existingIndex = pathToPageIndex.get(norm);

                if (existingIndex !== undefined) {
                    // Same page (hash navigation) — add as sub-page
                    const parentPage = pages[existingIndex];
                    // Only add if URL is different from parent
                    if (parentPage.url !== entry.url) {
                        const alreadyListed = parentPage.subPages.some(sp => sp.url === entry.url);
                        if (!alreadyListed) {
                            parentPage.subPages.push({
                                url: entry.url,
                                timestamp: entry.timestamp,
                                time: new Date(entry.timestamp).toLocaleTimeString()
                            });
                        }
                    }
                } else {
                    // New page
                    const pageObj = {
                        step: pages.length + 1,
                        url: entry.url,
                        localUrl: this.getLocalUrl(entry.url),
                        timestamp: entry.timestamp,
                        time: new Date(entry.timestamp).toLocaleTimeString(),
                        violations: [],
                        subPages: []
                    };
                    pathToPageIndex.set(norm, pages.length);
                    pages.push(pageObj);
                }
            } else if (entry.type === 'violation') {
                // Find which page this violation belongs to
                const violationNorm = this.normalizePath(entry.url);
                const pageIndex = pathToPageIndex.get(violationNorm);

                const violation = {
                    source: entry.source,
                    message: entry.message,
                    level: entry.level,
                    severity: entry.level === 2 ? 'critical' : 'warning',
                    timestamp: entry.timestamp,
                    time: new Date(entry.timestamp).toLocaleTimeString(),
                    resourceUrl: entry.url,
                    ...(entry.metadata && Object.keys(entry.metadata).length > 0 ? { metadata: entry.metadata } : {})
                };

                if (pageIndex !== undefined) {
                    pages[pageIndex].violations.push(violation);
                } else if (pages.length > 0) {
                    // Assign to last known page
                    pages[pages.length - 1].violations.push(violation);
                }
            }
        });

        // Build summary counts
        const allViolations = this.entries.filter(e => e.type === 'violation');
        const criticalCount = allViolations.filter(v => v.level === 2).length;
        const warningCount = allViolations.filter(v => v.level !== 2).length;

        return {
            session: {
                id: path.basename(this.reportPath, '.json'),
                startTime: new Date(firstTs).toISOString(),
                endTime: new Date(lastTs).toISOString(),
                date: new Date().toLocaleString(),
                totalPages: pages.length,
                totalSteps: navigations.length
            },
            summary: {
                health: criticalCount > 0 ? 'attention_required' : (warningCount > 0 ? 'stable' : 'perfect'),
                critical: criticalCount,
                warnings: warningCount,
                total: allViolations.length
            },
            journey: pages
        };
    }

    private getLocalUrl(maskedUrl: string) {
        if (!this.localSource) return maskedUrl;
        try {
            const url = new URL(maskedUrl);
            return `${url.protocol}//${this.localSource}${url.pathname}${url.search}${url.hash}`;
        } catch (e) {
            return maskedUrl;
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
        } else if (v.source === 'Scalability' && v.message.includes('Console Error')) {
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

            // Helper: normalize URL path to detect same-page hash navigations
            const normalizePath = (urlStr: string) => {
                try {
                    const u = new URL(urlStr);
                    return u.pathname.replace(/\/(index\.html?)?$/, '/');
                } catch { return urlStr; }
            };

            md += `## 🗺️ User Journey Analysis\n\n`;
            journey.forEach((step, index) => {
                const stepTitle = step.url === 'http://test/' ? 'Home Page' : step.url;
                const localUrl = this.getLocalUrl(step.url);

                md += `### Step ${index + 1}: ${stepTitle}\n`;
                md += `🔗 **Masked:** [${step.url}](${step.url})  \n`;
                md += `🛠️ **Local:** [${localUrl}](${localUrl})  \n`;
                md += `⏱️ *Time: ${new Date(step.timestamp).toLocaleTimeString()}*\n\n`;

                if (step.violations.length === 0) {
                    // Check if this is same page as a previous step that had violations
                    const currentNorm = normalizePath(step.url);
                    const parentStep = journey.find((s, i) => i < index && normalizePath(s.url) === currentNorm && s.violations.length > 0);

                    if (parentStep) {
                        const parentIndex = journey.indexOf(parentStep) + 1;
                        const parentTitle = parentStep.url === 'http://test/' ? '/' : new URL(parentStep.url).pathname;
                        const criticals = parentStep.violations.filter(v => v.level === 2).length;
                        const warnings = parentStep.violations.filter(v => v.level !== 2).length;
                        const countParts: string[] = [];
                        if (criticals > 0) countParts.push(`🔴 ${criticals} critical`);
                        if (warnings > 0) countParts.push(`🟡 ${warnings} warnings`);
                        md += `> **Status:** ↪️ *Same page as Step ${parentIndex} (${parentTitle}) — ${countParts.join(', ')} found there.*\n\n`;
                    } else {
                        md += `> **Status:** ✅ *No critical issues detected on this page.*\n\n`;
                    }
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
