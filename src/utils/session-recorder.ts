import { Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs/promises';
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

export interface RecorderConfig {
    projectPath: string;
}

export function attachRecorder(page: Page, config: RecorderConfig) {
    const { projectPath } = config;
    const sessionEvents: any[] = [];

    // Video Recorder Instance
    let recorder: any = null;
    let videoPath = '';

    // Manual Control API
    const init = async () => {
        // Expose Controls
        await page.exposeFunction('atlasStartRecording', async () => {
            if (recorder) return false;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            videoPath = path.join(projectPath, `session-${timestamp}.mp4`);
            console.log(`[Atlas] Starting Screen Recording: ${videoPath}`);
            try {
                recorder = new PuppeteerScreenRecorder(page);
                await recorder.start(videoPath);
                return true;
            } catch (e) {
                console.error('[Atlas] Failed to start recorder', e);
                return false;
            }
        });

        await page.exposeFunction('atlasStopRecording', async () => {
            if (recorder) {
                try {
                    await recorder.stop();
                    console.log(`[Atlas] 🎥 Screen Recording saved: ${videoPath}`);
                    recorder = null;
                    return relativePath(videoPath);
                } catch (e) { console.error(e); }
            }
            return null;
        });

        await page.exposeFunction('atlasRecordEvent', async (event: any) => {
            // Just track events for the summary log
            sessionEvents.push(event);
        });
    };

    // Helper
    const relativePath = (p: string) => path.relative(projectPath, p);

    const generateLog = async () => {
        // Only generate log if recording was started
        if (!videoPath) return;

        // Stop Recorder
        if (recorder) {
            try {
                await recorder.stop();
                console.log(`[Atlas] 🎥 Screen Recording saved: ${videoPath}`);
            } catch (e) { }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(projectPath, `visual-manual-${timestamp}.md`);
        const relativeVideoPath = path.relative(projectPath, videoPath);

        let md = `# Visual User Manual\n`;
        md += `**Project**: ${path.basename(projectPath)}\n`;
        md += `**Date**: ${new Date().toLocaleString()}\n`;
        md += `**Recorded By**: ATLAS Recorder\n\n`;

        md += `## Session Recording\n`;
        md += `> **[Click to Watch Session Video](${relativeVideoPath})**\n\n`;
        md += `*(Video file: ${relativeVideoPath})*\n\n`;

        md += `## Activity Log\n`;

        const pagesVisited = new Set(sessionEvents.map(e => {
            const d = e.details;
            return typeof d === 'object' ? d.url || e.url : e.url;
        }).filter(Boolean));

        md += `- **Pages Visited**: ${Array.from(pagesVisited).length}\n`;
        md += `- **Total Interactions**: ${sessionEvents.length}\n`;

        md += `\n---\nCreated automatically by Atlas.\n`;

        try {
            await fs.writeFile(filename, md);
            console.log(`[Atlas] 📘 Manual saved: ${filename}`);
        } catch (err) {
            console.error('[Atlas] Failed to save manual', err);
        }
    };

    return { init, generateLog };
}
