import { Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';
import { generateAtlasReport } from './report-generator';

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
    let lastSessionInfo: { id: string, parts: string[], startTime: number, endTime: number } | null = null;

    // Video Recorder Instance
    let recorder: any = null;

    // Manual Control API
    const init = async () => {
        // Shared Logic: Start Next Segment
        const startNextPart = async () => {
            if (!currentSession) return false;

            currentSession.partCount++;
            const filename = `session-${currentSession.id}-part${currentSession.partCount}.mp4`;
            const tempDir = path.join(projectPath, 'atlas_reports', '.temp');
            if (!require('fs').existsSync(tempDir)) require('fs').mkdirSync(tempDir, { recursive: true });

            const videoPath = path.join(tempDir, filename);
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

            lastSessionInfo = {
                id: currentSession.id,
                parts: [...currentSession.parts],
                startTime: currentSession.startTime,
                endTime: Date.now()
            };

            // Cleanup Cursor
            await page.evaluate(() => {
                // @ts-ignore
                if (window.__removeAtlasCursor) window.__removeAtlasCursor();
            });

            currentSession = null;
            recorder = null;
            return "Stopped (Ready to Generate Report)";
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

        await page.exposeFunction('atlasSubmitReport', async (violations: any[]) => {
            const info = currentSession || lastSessionInfo;
            if (!info) return null;

            // 1. Create Subfolder for this specific report
            const reportId = `report_${info.id}`;
            const targetDir = path.join(projectPath, 'atlas_reports', reportId);
            if (!require('fs').existsSync(targetDir)) require('fs').mkdirSync(targetDir, { recursive: true });

            // 2. Finalize recording (Merge only now)
            const videoPath = await generateLog(targetDir, info);

            // 3. Format Metadata
            const ua = await page.evaluate(() => navigator.userAgent);

            // 4. Generate the Audit Report
            const report = generateAtlasReport(targetDir, {
                timestamp: info.id,
                domain: await page.evaluate(() => window.location.hostname),
                duration: info === currentSession
                    ? `${Math.round((Date.now() - info.startTime) / 1000)}s`
                    : `${Math.round(((lastSessionInfo as any).endTime - info.startTime) / 1000)}s`,
                violations: violations,
                videoPath: videoPath || undefined,
                metadata: {
                    userAgent: ua,
                    platform: process.platform
                }
            });

            // 5. UX: Auto-Open Report Folder (Windows)
            try {
                const fullPath = path.resolve(targetDir);
                require('child_process').exec(`start "" "${fullPath}"`);
            } catch (e) { }

            return reportId; // Return the folder name or relative path
        });
    };

    // Helper
    const relativePath = (p: string) => path.relative(projectPath, p);

    const generateLog = async (targetDir: string, sessionData: any) => {
        if (!sessionData || sessionData.parts.length === 0) return null;

        const timestamp = sessionData.id;
        const finalVideoPath = path.join(targetDir, `session-recording.mp4`);

        // --- MERGE VIDEO PARTS ---
        if (sessionData.parts.length === 1) {
            const part = sessionData.parts[0];
            try {
                await fs.copyFile(part, finalVideoPath);
            } catch (e) { return null; }
        } else {
            console.log(`[Atlas] ⏳ Merging ${sessionData.parts.length} video parts...`);
            const listFile = path.join(targetDir, `merge-${timestamp}.txt`);

            try {
                const fileListContent = sessionData.parts.map((p: string) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
                await fs.writeFile(listFile, fileListContent);
                const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${listFile}" -c copy "${finalVideoPath}"`;
                await execPromise(cmd);
                await fs.unlink(listFile);
            } catch (e) {
                console.error('[Atlas] Video Merge Failed:', e);
                return null;
            }
        }
        return finalVideoPath;
    };

    return { init, generateLog };
}
