import { Violation } from './state';
import path from 'path';

export interface PageReport {
    step: number;
    url: string;
    localUrl: string;
    timestamp: number;
    time: string;
    duration: string;
    metrics?: { loadTime: number; storage: number };
    violations: any[];
    subPages: { url: string; timestamp: number; time: string }[];
}

export function normalizePath(urlStr: string): string {
    try {
        const u = new URL(urlStr);
        return u.pathname.replace(/\/(index\.html?)?$/, '/');
    } catch { return urlStr; }
}

export function getLocalUrl(maskedUrl: string, localSource: string): string {
    if (!localSource) return maskedUrl;
    try {
        const url = new URL(maskedUrl);
        // Only map if it's the target domain or already localhost
        return `${url.protocol}//${localSource}${url.pathname}${url.search}${url.hash}`;
    } catch (e) {
        return maskedUrl;
    }
}

/** 
 * Maps any URL to its local equivalent and normalizes the path 
 * to allow accurate comparison (e.g. masked domain vs localhost).
 */
export function getNormalizedEffectiveUrl(url: string, localSource: string): string {
    const local = getLocalUrl(url, localSource);
    return normalizePath(local);
}

export function buildTreeReport(entries: Violation[], localSource: string) {
    const pages: PageReport[] = [];
    const pathToPageIndex = new Map<string, number>();

    entries.forEach((entry, idx) => {
        if (entry.type === 'navigation') {
            const norm = getNormalizedEffectiveUrl(entry.url, localSource);
            const existingIndex = pathToPageIndex.get(norm);

            let duration = '—';
            const nextEntry = entries.slice(idx + 1).find(e => e.type === 'navigation');
            if (nextEntry) {
                const ms = nextEntry.timestamp - entry.timestamp;
                duration = ms > 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
            }

            if (existingIndex !== undefined) {
                const parentPage = pages[existingIndex];
                if (entry.metrics) {
                    parentPage.metrics = entry.metrics;
                    parentPage.duration = duration;
                }
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
                const pageObj: PageReport = {
                    step: pages.length + 1,
                    url: entry.url,
                    localUrl: getLocalUrl(entry.url, localSource),
                    timestamp: entry.timestamp,
                    time: new Date(entry.timestamp).toLocaleTimeString(),
                    duration,
                    metrics: entry.metrics,
                    violations: [],
                    subPages: []
                };
                pathToPageIndex.set(norm, pages.length);
                pages.push(pageObj);
            }
        } else if (entry.type === 'violation') {
            const violationNorm = getNormalizedEffectiveUrl(entry.url, localSource);
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
                pages[pages.length - 1].violations.push(violation);
            }
        }
    });

    const allViolations = entries.filter(e => e.type === 'violation');
    const criticalCount = allViolations.filter(v => v.level === 2).length;
    const warningCount = allViolations.filter(v => v.level !== 2).length;

    return {
        summary: {
            critical: criticalCount,
            warnings: warningCount,
            total: allViolations.length
        },
        journey: pages
    };
}

export function translateViolation(v: Violation, localSource: string) {
    let title = v.message;
    let impact = "Potential impact on user experience.";
    let recommendation = "Review the affected resource and ensure it is accessible.";
    let icon = v.level === 2 ? '🔴' : '🟡';

    if (v.source === 'Network' && v.message.includes('404')) {
        title = `Broken Link: ${v.message.split(' on ')[1] || 'Unknown'}`;
        impact = "Users will encounter missing content or broken navigation, hurting trust.";
        recommendation = "Update the link to a valid URL or remove the broken reference.";
    } else if (v.source === 'Network' && (v.message.includes('ERR_CONNECTION_REFUSED') || v.message.includes('timeout'))) {
        title = "Local Server Connection Failed";
        impact = "The browser tried to reach your project's local server, but it didn't respond or timed out.";
        recommendation = "Ensure your project's 'start' script keeps a server running and stays alive. Atlas needs an active port to connect to.";
        icon = '🔴';
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

export function generateMarkdown(entries: Violation[], localSource: string, reportId: string): string {
    const violations = entries.filter(e => e.type === 'violation');
    const criticalCount = violations.filter(v => v.level === 2).length;
    const warningCount = violations.filter(v => v.level !== 2).length;

    let md = `# 📊 Atlas Audit Executive Summary\n\n`;
    md += `> **Session ID:** \`${reportId}\`  \n`;
    md += `> **Date:** ${new Date().toLocaleString()}  \n\n`;

    md += `## 📈 Health Overview\n\n`;

    const healthScore = violations.length === 0 ? "Perfect" : (criticalCount > 0 ? "Attention Required" : "Stable");
    const healthIcon = violations.length === 0 ? "🟢" : (criticalCount > 0 ? "🔴" : "🟡");

    const uniquePages = new Set(entries.filter(e => e.type === 'navigation').map(e => getNormalizedEffectiveUrl(e.url, localSource)));
    const navigableSteps = entries.filter(e => e.type === 'navigation' && e.metrics);
    const avgLoadTime = navigableSteps.length > 0
        ? Math.round(navigableSteps.reduce((acc, curr) => acc + (curr.metrics?.loadTime || 0), 0) / navigableSteps.length)
        : 0;

    md += `| Metric | Status | Count |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| **Site Health** | ${healthIcon} ${healthScore} | - |\n`;
    md += `| **Critical Issues** | 🔴 High Impact | ${criticalCount} |\n`;
    md += `| **Warnings** | 🟡 Medium Impact | ${warningCount} |\n`;
    md += `| **Pages Visited** | 🗺️ Unique URLs | ${uniquePages.size} |\n`;
    if (avgLoadTime > 0) md += `| **Avg Load Time** | ⚡ Performance | ${avgLoadTime}ms |\n`;
    md += `\n`;

    md += `#### 🔄 Visit Frequency\n\n`;
    md += `| Page | Visits | Last Visit |\n`;
    md += `| :--- | :--- | :--- |\n`;

    const visitCounts = new Map<string, { count: number, lastTime: number }>();
    entries.filter(e => e.type === 'navigation').forEach(e => {
        const norm = getNormalizedEffectiveUrl(e.url, localSource);
        const current = visitCounts.get(norm) || { count: 0, lastTime: 0 };
        visitCounts.set(norm, {
            count: current.count + 1,
            lastTime: Math.max(current.lastTime, e.timestamp)
        });
    });

    visitCounts.forEach((data, url) => {
        const local = getLocalUrl(url, localSource);
        let displayUrl = url;
        try {
            displayUrl = (new URL(url).pathname === '/' || url === 'http://test/') ? '/' : new URL(url).pathname;
        } catch (e) {
            displayUrl = url;
        }
        md += `| [${displayUrl}](${local}) | **${data.count}** | ${new Date(data.lastTime).toLocaleTimeString()} |\n`;
    });
    md += `\n`;

    md += `--- \n\n`;

    let journey: { url: string, timestamp: number, metrics?: { loadTime: number, storage: number }, violations: Violation[] }[] = [];
    entries.forEach(entry => {
        if (entry.type === 'navigation') {
            const currentNorm = getNormalizedEffectiveUrl(entry.url, localSource);
            const lastStep = journey[journey.length - 1];
            const lastNorm = lastStep ? getNormalizedEffectiveUrl(lastStep.url, localSource) : null;

            if (journey.length === 0 || lastNorm !== currentNorm) {
                journey.push({ url: entry.url, timestamp: entry.timestamp, metrics: entry.metrics, violations: [] });
            } else if (entry.metrics) {
                lastStep.metrics = entry.metrics;
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
        const localUrl = getLocalUrl(step.url, localSource);
        let duration = '—';
        const nextStep = journey[index + 1];
        if (nextStep) {
            const ms = nextStep.timestamp - step.timestamp;
            duration = ms > 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
        } else {
            duration = 'End';
        }

        md += `### Step ${index + 1}: ${step.url}\n`;
        md += `🔗 **Masked:** [${step.url}](${step.url})  \n`;
        md += `🛠️ **Local:** [${localUrl}](${localUrl})  \n`;

        const metaParts = [`⏱️ *${new Date(step.timestamp).toLocaleTimeString()}*`];
        if (step.metrics) {
            metaParts.push(`⚡ **Load:** ${step.metrics.loadTime}ms`);
            metaParts.push(`💾 **Storage:** ${step.metrics.storage}KB`);
        }
        metaParts.push(`⏳ **Duration:** ${duration}`);
        md += `${metaParts.join(' • ')}\n\n`;

        if (step.violations.length === 0) {
            const currentNorm = normalizePath(step.url);
            const parentStep = journey.find((s, i) => i < index && normalizePath(s.url) === currentNorm && s.violations.length > 0);
            if (parentStep) {
                const parentIndex = journey.indexOf(parentStep) + 1;
                md += `> **Status:** ↪️ *Same page as Step ${parentIndex} — Violations listed there.*\n\n`;
            } else {
                md += `> **Status:** ✅ *No critical issues detected on this page.*\n\n`;
            }
        } else {
            const uniqueViolations = new Map<string, { v: Violation, count: number }>();
            step.violations.forEach(v => {
                const key = `${v.source}|${v.message}|${v.url}`;
                const existing = uniqueViolations.get(key);
                if (existing) existing.count++;
                else uniqueViolations.set(key, { v, count: 1 });
            });

            uniqueViolations.forEach(({ v, count }) => {
                const { title, impact, recommendation, icon } = translateViolation(v, localSource);
                const localViolationUrl = getLocalUrl(v.url, localSource);
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
    return md;
}
