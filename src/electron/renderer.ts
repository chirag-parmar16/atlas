import { pill, pillCount, menu } from './setup-api';

// Dynamically import tools to ensure window.Atlas is initialized first
async function loadTools() {
    await import('./ui/links');
    await import('./ui/console');
    await import('./ui/networks');
    await import('./ui/application');
    await import('./ui/storage');
    await import('./ui/stability');
    await import('./ui/security-monitor');
    await import('./ui/extras');
    await import('./ui/recorder');
    console.log('[Atlas] All UI Tools loaded dynamically.');
}
loadTools();

console.log('[Atlas] Host HUD Initialized');
const webview = document.getElementById('project-view') as any;
const urlInput = document.getElementById('hud-url-input') as HTMLInputElement;

webview.addEventListener('dom-ready', () => {
    console.log('[Atlas] Guest webview process ready.');
});
const tagDomain = document.getElementById('tag-domain');
const tagPort = document.getElementById('tag-port');

// Parse Domain/Port from URL params
const params = new URLSearchParams(window.location.search);
if (params.has('domain') && tagDomain) tagDomain.textContent = params.get('domain');
if (params.has('port') && tagPort) tagPort.textContent = ':' + params.get('port');

// Window Control Handlers
(document.getElementById('win-min-btn') as HTMLElement).onclick = () => (window as any).atlasControls.minimize();
(document.getElementById('win-max-btn') as HTMLElement).onclick = () => (window as any).atlasControls.maximize();
(document.getElementById('win-close-btn') as HTMLElement).onclick = () => (window as any).atlasControls.close();

// Navigation Handlers
(document.getElementById('hud-back-btn') as HTMLElement).onclick = () => webview.goBack();
(document.getElementById('hud-fwd-btn') as HTMLElement).onclick = () => webview.goForward();

// URL Input Handler
urlInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (!url.startsWith('http')) url = 'https://' + url;
        webview.src = url;
        urlInput.blur();
    }
};

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

// Sync URL on navigation
webview.addEventListener('did-start-navigation', (e: any) => {
    if (e.isMainFrame) {
        urlInput.value = formatDisplayURL(e.url);
        if (e.url !== 'about:blank') {
            webview.style.opacity = '1';
        }
    }
});

webview.addEventListener('dom-ready', () => {
    if (webview.getURL() !== 'about:blank') {
        webview.style.opacity = '1';
    }
});

webview.addEventListener('did-finish-load', () => {
    if (webview.getURL() !== 'about:blank') {
        webview.style.opacity = '1';
    }
});

webview.addEventListener('did-navigate', (e: any) => {
    urlInput.value = formatDisplayURL(e.url);
    if (e.url !== 'about:blank') {
        webview.style.opacity = '1';
    }
});

webview.addEventListener('did-navigate-in-page', (e: any) => {
    urlInput.value = formatDisplayURL(e.url);
});

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
    if ((window as any).atlasTogglePause) {
        await (window as any).atlasTogglePause(isRecordingPaused);
        (window as any).updateRecorder({ isRecording: true, paused: isRecordingPaused });
    }
};

(document.getElementById('pill-stop-btn') as HTMLElement).onclick = async (e) => {
    e.stopPropagation();
    if ((window as any).atlasStopRecording) {
        await (window as any).atlasStopRecording();
        (window as any).updateRecorder({ isRecording: false });
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