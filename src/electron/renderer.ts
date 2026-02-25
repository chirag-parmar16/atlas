import { pill, pillCount, menu } from './setup-api';
import { TabManager } from './tab-manager';

const params = new URLSearchParams(window.location.search);
const disabledTabsStr = params.get('disabledTabs') || '';
const disabledTabs = new Set(disabledTabsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean));

// Dynamically import tools only if not disabled
async function loadTools() {
    if (!disabledTabs.has('links')) await import('./ui/links');
    if (!disabledTabs.has('console')) await import('./ui/console');
    if (!disabledTabs.has('networks') && !disabledTabs.has('network')) await import('./ui/networks');
    if (!disabledTabs.has('application')) await import('./ui/application');
    if (!disabledTabs.has('storage')) await import('./ui/storage');
    if (!disabledTabs.has('stability') && !disabledTabs.has('scalability')) await import('./ui/stability');
    if (!disabledTabs.has('security-monitor') && !disabledTabs.has('security')) await import('./ui/security-monitor');
    if (!disabledTabs.has('extras')) await import('./ui/extras');
    if (!disabledTabs.has('recorder')) await import('./ui/recorder');
    console.log('[Atlas] UI Tools filtering complete.');
}
loadTools();

console.log('[Atlas] Host HUD Initialized');
const urlInput = document.getElementById('hud-url-input') as HTMLInputElement;
const tabBar = document.getElementById('atlas-tab-bar') as HTMLElement;
const webviewContainer = document.getElementById('webview-container') as HTMLElement;

// Parse Domain/Port from URL params
const tagDomain = document.getElementById('tag-domain');
const tagPort = document.getElementById('tag-port');
const initialDomain = params.get('domain') || '';
const initialPort = params.get('port') || '';
const projectName = params.get('projectName') || '';
const initialUrl = initialPort ? `http://localhost:${initialPort}` : 'about:blank';

if (params.has('domain') && tagDomain) tagDomain.textContent = initialDomain;
if (params.has('port') && tagPort) tagPort.textContent = ':' + initialPort;

// Apply Project Identity
if (projectName) {
    const fullTitle = `Atlas - ${projectName}`;
    document.title = fullTitle;

    const hudLabel = document.getElementById('hud-atlas-label');
    if (hudLabel) hudLabel.textContent = fullTitle.toUpperCase();
}

// Initialize the Tab Manager with URL bar sync
const tabManager = new TabManager(
    webviewContainer,
    tabBar,
    // onActivate: sync the URL bar to the active tab
    (tab) => {
        urlInput.value = formatDisplayURL(tab.url);
    },
    // onClose
    (_tab) => { }
);

// Create the initial tab pointing to the proxied project
tabManager.createTab(initialUrl);

// Expose tabManager globally so extras.ts can reach the active webview
(window as any)._atlasTabManager = tabManager;

// Listen for main-process new-window interceptions (target="_blank" links)
// Main process blocks the native new window and tells us to open it as a tab instead
(window as any).atlasTabBridge?.onOpenTab((url: string) => {
    console.log(`[Atlas] Opening _blank link as tab: ${url}`);
    tabManager.createTab(url);
});

// URL Formatter for Domain Masking
function formatDisplayURL(rawUrl: string) {
    if (!rawUrl || rawUrl === 'about:blank') return 'about:blank';
    const domain = tagDomain ? tagDomain.textContent?.trim() || '' : '';
    let display = rawUrl;

    // Replace localhost with masked domain
    display = display.replace(/^https?:\/\/localhost(:\d+)?/, `https://${domain}`);

    // Hide extensions (.html)
    display = display.replace(/\.html$/, '');
    display = display.replace(/\/index$/, '/');

    return display;
}

// Window Control Handlers
(document.getElementById('win-min-btn') as HTMLElement).onclick = () => (window as any).atlasControls.minimize();
(document.getElementById('win-max-btn') as HTMLElement).onclick = () => (window as any).atlasControls.maximize();
(document.getElementById('win-close-btn') as HTMLElement).onclick = () => (window as any).atlasControls.close();

// Navigation Handlers
(document.getElementById('hud-back-btn') as HTMLElement).onclick = () => tabManager.goBack();
(document.getElementById('hud-fwd-btn') as HTMLElement).onclick = () => tabManager.goForward();

// New Tab Button
document.getElementById('atlas-new-tab-btn')!.onclick = () => tabManager.createTab('about:blank');

// URL Input Handler
urlInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        tabManager.navigate(urlInput.value.trim());
        urlInput.blur();
    }
};
// --- RECORDER UI LOGIC ---
let recordingStartTime = 0;
let recordingInterval: any = null;
let isRecordingPaused = false;

(window as any).updateRecorder = (state: { isRecording: boolean, paused?: boolean }) => {
    const recDot = document.getElementById('pill-rec-indicator');
    const recTimer = document.getElementById('pill-rec-timer');
    const pillLabel = document.getElementById('pill-label');
    const pillControls = document.getElementById('pill-controls');
    const pauseBtn = document.getElementById('pill-pause-btn');

    if (state.isRecording) {
        pill.classList.add('recording');
        if (recDot) recDot.style.display = 'block';
        if (recTimer) recTimer.style.display = 'block';
        if (pillLabel) pillLabel.style.display = 'none';
        if (pillControls) pillControls.style.display = 'flex';

        // Auto-close menu if open
        if (menu.classList.contains('visible')) toggleMenu();

        if (!recordingInterval) {
            recordingStartTime = Date.now();
            recordingInterval = setInterval(updateRecordingTimer, 1000);
        }
    } else {
        pill.classList.remove('recording');
        if (recDot) recDot.style.display = 'none';
        if (recTimer) recTimer.style.display = 'none';
        if (pillLabel) pillLabel.style.display = 'block';
        if (pillControls) pillControls.style.display = 'none';

        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }
    }

    if (state.paused !== undefined) {
        isRecordingPaused = state.paused;
        if (pauseBtn) {
            pauseBtn.innerHTML = isRecordingPaused
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
        }
    }
};

let mediaRecorder: MediaRecorder | null = null;
let recordedSessionId = '';

(window as any).startNativeRecording = async () => {
    try {
        const sourceId = await (window as any).atlasNativeRecorder.getWindowSource();
        if (!sourceId) return false;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minFrameRate: 30,
                    maxFrameRate: 30
                }
            } as any
        });

        recordedSessionId = new Date().toISOString().replace(/[:.]/g, '-');
        mediaRecorder = new (window as any).MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

        mediaRecorder!.ondataavailable = async (e: any) => {
            if (e.data.size > 0) {
                const buffer = await e.data.arrayBuffer();
                (window as any).atlasNativeRecorder.saveChunk(recordedSessionId, buffer);
            }
        };

        mediaRecorder!.start(1000); // emit chunks every second
        (window as any).updateRecorder({ isRecording: true });
        return true;
    } catch (e) {
        console.error('[Atlas] Native recording failed:', e);
        return false;
    }
};

(window as any).stopNativeRecording = async () => {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((t: any) => t.stop());
        setTimeout(() => {
            (window as any).atlasNativeRecorder.finalize(recordedSessionId);
            mediaRecorder = null;
        }, 1500); // Flush final chunks
        (window as any).updateRecorder({ isRecording: false });
    }
};

(window as any).pauseNativeRecording = (paused: boolean) => {
    if (mediaRecorder) {
        if (paused) mediaRecorder.pause();
        else mediaRecorder.resume();
        (window as any).updateRecorder({ isRecording: true, paused });
    }
};

function updateRecordingTimer() {
    if (isRecordingPaused) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    const timerEl = document.getElementById('pill-rec-timer');
    if (timerEl) timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Initial state
(window as any).updateRecorder({ isRecording: false });

// Pill Control Listeners
(document.getElementById('pill-pause-btn') as HTMLElement).onclick = async (e) => {
    e.stopPropagation(); // Don't drag/toggle menu
    isRecordingPaused = !isRecordingPaused;
    if (typeof (window as any).pauseNativeRecording === 'function') {
        (window as any).pauseNativeRecording(isRecordingPaused);
    }
};

(document.getElementById('pill-stop-btn') as HTMLElement).onclick = async (e) => {
    e.stopPropagation();
    if (typeof (window as any).stopNativeRecording === 'function') {
        (window as any).stopNativeRecording();
    }
};

// --- DRAG LOGIC ---
let isDragging = false;
let startX: number, startY: number, initialLeft: number, initialTop: number;

function updateMenuPosition() {
    const rect = pill.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Default: show menu above the pill
    let top = rect.top - 510;
    let left = rect.right - 600;

    // Flip to below if too close to top
    if (top < 10) top = rect.bottom + 10;
    // Align left if too close to right edge
    if (left < 10) left = 10;
    if (left + 600 > winW - 10) left = winW - 610;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

// Restore postion
const savedPos = localStorage.getItem('atlas-pill-pos');
if (savedPos) {
    const pos = JSON.parse(savedPos);
    pill.style.left = pos.x;
    pill.style.top = pos.y;
    pill.style.bottom = 'auto';
    pill.style.right = 'auto';
    updateMenuPosition();
}

pill.addEventListener('mousedown', (e: MouseEvent) => {
    // Avoid drag when clicking status icon or count if menu is open?
    // For now, allow drag except on menu toggle?
    // If dragging, don't toggle menu.
    let dragStartTime = Date.now();

    isDragging = true;
    const rect = pill.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;

    // Switch to absolute positioning
    pill.style.bottom = 'auto';
    pill.style.right = 'auto';
    pill.style.left = initialLeft + 'px';
    pill.style.top = initialTop + 'px';

    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', (e) => {
        onDragEnd();
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        // Only toggle if it wasn't a significant drag
        if (dx < 5 && dy < 5) {
            toggleMenu();
        }
    }, { once: true });
});

function onDragging(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    pill.style.left = (initialLeft + dx) + 'px';
    pill.style.top = (initialTop + dy) + 'px';
    updateMenuPosition();
}

function onDragEnd() {
    isDragging = false;
    pill.classList.remove('is-dragging');
    document.removeEventListener('mousemove', onDragging);

    // Persist position
    localStorage.setItem('atlas-pill-pos', JSON.stringify({
        x: pill.style.left,
        y: pill.style.top
    }));
}

// --- MENU LOGIC ---
function toggleMenu() {
    menu.classList.toggle('visible');
    updateMenuPosition();
}


// --- RESIZE RESILIENCE ---
window.addEventListener('resize', () => {
    if (pill.style.left) {
        const rect = pill.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Adjust if outside bounds
        if (rect.right > winW - 10) pill.style.left = (winW - rect.width - 24) + 'px';
        if (rect.bottom > winH - 10) pill.style.top = (winH - rect.height - 24) + 'px';
        if (rect.left < 10) pill.style.left = '24px';
        if (rect.top < 10) pill.style.top = '64px'; // HUD height offset
    }
});