import { Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';

const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const execPromise = util.promisify(exec);

export interface RecorderConfig {
    projectPath: string;
}

export function attachRecorder(page: Page, config: RecorderConfig) {
    const { projectPath } = config;
    const sessionEvents: any[] = [];

    // Session State
    let currentSession: {
        id: string,
        parts: string[],
        partCount: number,
        activeVideoPath: string | null,
        startTime: number
    } | null = null;

    // Video Recorder Instance
    let recorder: any = null;

    // Manual Control API
    const init = async () => {
        // Shared Logic: Start Next Segment
        const startNextPart = async () => {
            if (!currentSession) return false;

            currentSession.partCount++;
            const filename = `session-${currentSession.id}-part${currentSession.partCount}.mp4`;
            const videoPath = path.join(projectPath, filename);
            currentSession.activeVideoPath = videoPath;

            console.log(`[Atlas] 🎬 Starting Recording Part ${currentSession.partCount}: ${filename}`);

            try {
                recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
                await recorder.start(videoPath);

                // Inject Cursor if missing
                await injectCursor();
                return true;
            } catch (e) {
                console.error('[Atlas] Failed to start recorder', e);
                return false;
            }
        };

        const injectCursor = async () => {
            await page.evaluate(() => {
                if (document.getElementById('atlas-fake-cursor')) return;
                const cursor = document.createElement('div');
                cursor.id = 'atlas-fake-cursor';
                cursor.style.position = 'fixed';
                cursor.style.top = '0';
                cursor.style.left = '0';
                cursor.style.width = '20px';
                cursor.style.height = '20px';
                cursor.style.background = 'rgba(255, 0, 0, 0.5)';
                cursor.style.border = '2px solid white';
                cursor.style.borderRadius = '50%';
                cursor.style.pointerEvents = 'none';
                cursor.style.zIndex = '2147483647';
                cursor.style.transition = 'transform 0.05s';
                cursor.style.mixBlendMode = 'difference';
                document.body.appendChild(cursor);

                window.addEventListener('mousemove', (e) => {
                    cursor.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 10}px)`;
                });
                // @ts-ignore
                window.__removeAtlasCursor = () => cursor.remove();
            });
        };

        // Expose Controls
        await page.exposeFunction('atlasStartRecording', async () => {
            if (currentSession) return false; // Already recording

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            currentSession = {
                id: timestamp,
                parts: [],
                partCount: 0,
                activeVideoPath: null,
                startTime: Date.now()
            };

            return await startNextPart();
        });

        await page.exposeFunction('atlasStopRecording', async () => {
            if (!currentSession) return null;

            // Stop current part
            if (recorder && currentSession.activeVideoPath) {
                try {
                    await recorder.stop();
                    currentSession.parts.push(currentSession.activeVideoPath);
                } catch (e) { console.error(e); }
            }

            // Cleanup Cursor
            await page.evaluate(() => {
                // @ts-ignore
                if (window.__removeAtlasCursor) window.__removeAtlasCursor();
            });

            // Generate Report immediately
            const reportPath = await generateLog();

            currentSession = null;
            recorder = null;
            return reportPath ? relativePath(reportPath) : null;
        });

        await page.exposeFunction('atlasTogglePause', async (paused: boolean) => {
            if (!currentSession) return;

            if (paused) {
                // TRUE PAUSE: Stop the recorder!
                console.log('[Atlas] ⏸ Pausing Recording (Saving Part)');
                if (recorder && currentSession.activeVideoPath) {
                    await recorder.stop();
                    currentSession.parts.push(currentSession.activeVideoPath);
                    currentSession.activeVideoPath = null;
                    recorder = null;
                }
                // No Overlay: User requested native view.
            } else {
                // RESUME: Start new Part!
                console.log('[Atlas] ▶ Resuming Recording (Starting New Part)');
                await startNextPart();
            }
        });

        await page.exposeFunction('atlasRecordEvent', async (event: any) => {
            sessionEvents.push(event);
        });
    };

    // Helper
    const relativePath = (p: string) => path.relative(projectPath, p);

    const generateLog = async () => {
        if (!currentSession || currentSession.parts.length === 0) return null;

        const timestamp = currentSession.id;
        // Make sure we stop any active recorder first
        if (recorder) {
            try {
                await recorder.stop();
                if (currentSession.activeVideoPath && !currentSession.parts.includes(currentSession.activeVideoPath)) {
                    currentSession.parts.push(currentSession.activeVideoPath);
                }
            } catch (e) { }
        }

        // --- MERGE VIDEO PARTS ---
        let finalVideoPath = '';

        if (currentSession.parts.length === 1) {
            // Single file, just rename for cleanliness
            const part = currentSession.parts[0];
            finalVideoPath = path.join(projectPath, `session-${timestamp}.mp4`);
            try {
                await fs.rename(part, finalVideoPath);
            } catch (e) {
                finalVideoPath = part; // Fallback
            }
        } else {
            // Multiple parts: Merge!
            console.log(`[Atlas] ⏳ Merging ${currentSession.parts.length} video parts...`);
            const listFile = path.join(projectPath, `merge-${timestamp}.txt`);
            finalVideoPath = path.join(projectPath, `session-${timestamp}.mp4`);

            try {
                // 1. Create file list
                const fileListContent = currentSession.parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
                await fs.writeFile(listFile, fileListContent);

                // 2. Run FFmpeg Concat
                // -f concat -safe 0 -i list.txt -c copy output.mp4
                const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${listFile}" -c copy "${finalVideoPath}"`;
                await execPromise(cmd);

                // 3. Cleanup parts
                console.log('[Atlas] ✅ Merge Complete. Cleaning up parts...');
                await fs.unlink(listFile);
                for (const part of currentSession.parts) {
                    try { await fs.unlink(part); } catch (e) { }
                }

            } catch (e) {
                console.error('[Atlas] Video Merge Failed:', e);
                // Fallback: Just use the first part or keep them separate? 
                // Let's just point to the first one but list them in MD if merge failed
                return null;
            }
        }

        const filename = path.join(projectPath, `visual-manual-${timestamp}.md`);
        const relVideo = relativePath(finalVideoPath);

        let md = `# Visual User Manual\n`;
        md += `**Project**: ${path.basename(projectPath)}\n`;
        md += `**Date**: ${new Date(currentSession.startTime).toLocaleString()}\n`;
        md += `**Recorded By**: ATLAS Recorder\n\n`;

        md += `## Session Recording\n`;
        md += `> **[▶ Watch Full Session Video](${relVideo})**\n\n`;
        md += `*(Video file: ${relVideo})*\n\n`;

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
            return finalVideoPath; // Return the final video path for the UI toast
        } catch (err) {
            console.error('[Atlas] Failed to save manual', err);
            return null;
        }
    };

    return { init, generateLog };
}
