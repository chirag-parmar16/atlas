
export const RECORDER = `
// recorder.js
(function () {
    const formatTime = () => new Date().toISOString().split('T')[1].split('.')[0];

    let isRecording = false; // Default OFF
    const eventQueue = [];
    let isSending = false;

    const processQueue = async () => {
        if (isSending || eventQueue.length === 0 || !window.atlasRecordEvent) return;
        isSending = true;
        while (eventQueue.length > 0) {
            const evt = eventQueue[0];
            try {
                await window.atlasRecordEvent(evt);
                eventQueue.shift();
            } catch (e) {
                console.error('[Recorder] Failed to send event', e);
                break; // Stop and retry later
            }
        }
        isSending = false;
    };

    const sendEvent = (type, details) => {
        if (!isRecording) return; // Only record if enabled

        eventQueue.push({
            time: formatTime(),
            url: window.location.pathname,
            type,
            details
        });
        processQueue();
    };

    // Poll for availability
    setInterval(processQueue, 500);

    // --- 1. Navigation Tracking ---
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        sendEvent('NAVIGATION', \`Navigated to \${window.location.pathname}\`);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        sendEvent('NAVIGATION', \`Replaced state: \${window.location.pathname}\`);
    };

    window.addEventListener('popstate', () => {
        sendEvent('NAVIGATION', \`Navigated (Back/Forward) to \${window.location.pathname}\`);
    });

    // --- 2. Interaction Tracking ---

    // Helper to identify interactive elements
    const isInteractive = (el) => {
        if (!el) return false;
        const tag = el.tagName;
        if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'].includes(tag)) return true;
        const style = window.getComputedStyle(el);
        return style.cursor === 'pointer';
    };

    const getLabel = (el) => {
        return el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'Unknown Element';
    };

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Don't record clicks on our own tools
        if (target.closest('#atlas-floating-window')) return;

        // Smart Filter: Only record if element looks interactive
        // We traverse up a bit to see if we clicked an icon inside a button
        let clickable = target.closest('a, button, input, select, textarea, [role="button"]');
        if (!clickable && !isInteractive(target)) {
            // Check direct parent too just in case
            if (!isInteractive(target.parentElement)) return;
            clickable = target.parentElement; // Assume parent is the intent
        }
        if (!clickable) clickable = target; // Fallback

        let label = getLabel(clickable);
        if (label.length > 50) label = label.substring(0, 50) + '...';

        sendEvent('ACTION', {
            tag: clickable.tagName,
            label: label.trim(),
            id: clickable.id,
            className: clickable.className
        });
    }, true);

    // Track Input Changes (Text/Select)
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            let label = getLabel(target);

            sendEvent('INPUT', {
                tag: target.tagName,
                inputType: target.type,
                label: label.trim(),
                value: target.value
            });
        }
    }, true);


    // --- 3. Error Tracking ---
    window.addEventListener('error', (e) => {
        sendEvent('ERROR', \`\${e.message} at \${e.filename}:\${e.lineno}\`);
    });

    window.addEventListener('unhandledrejection', (e) => {
        sendEvent('ERROR', \`Unhandled Promise Rejection: \${e.reason}\`);
    });

    // --- 4. Network Error Tracking Integration ---
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        try {
            const res = await originalFetch.apply(this, args);
            if (res.status >= 400) {
                const url = (typeof args[0] === 'string') ? args[0] : args[0].url;
                sendEvent('API_ERROR', \`\${res.status} \${res.statusText} on \${url}\`);
            }
            return res;
        } catch (e) {
            const url = (typeof args[0] === 'string') ? args[0] : args[0].url;
            sendEvent('API_ERROR', \`Network connection failed on \${url}\`);
            throw e;
        }
    };

    // UI Indicator / Toggle
    window.Atlas.addTool('Record', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.height = '100%';

        const btn = document.createElement('button');
        btn.innerText = 'Start Recording';
        btn.style.background = '#444';
        btn.style.border = '1px solid #555';
        btn.style.color = '#fff';
        btn.style.padding = '8px 12px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';

        const status = document.createElement('div');
        status.style.marginTop = '8px';
        status.style.fontSize = '10px';
        status.style.color = '#888';
        status.innerText = 'Status: Off';

        btn.onclick = async () => {
            if (!isRecording) {
                // START
                status.innerText = 'Status: ⏳ Starting...';
                if (window.atlasStartRecording) {
                    const success = await window.atlasStartRecording();
                    if (success) {
                        isRecording = true;
                        if (window.Atlas.setRecordingState) window.Atlas.setRecordingState(true);
                        
                        btn.innerText = 'Stop Recording';
                        btn.style.background = '#d32f2f';
                        status.innerText = 'Status: ● Recording...';
                        status.style.color = '#ff4444';
                        sendEvent('NAVIGATION', \`Recording Started at \${window.location.pathname}\`);
                    } else {
                        status.innerText = 'Status: Failed to start';
                        status.style.color = 'red';
                    }
                }
            } else {
                // STOP
                stopRecording();
            }
        };



        const stopRecording = async () => {
             status.innerText = 'Status: ⏳ Stopping...';
             if (window.atlasStopRecording) {
                 const file = await window.atlasStopRecording();
                 isRecording = false;
                 if (window.Atlas.setRecordingState) window.Atlas.setRecordingState(false);
                 
                 btn.innerText = 'Start Recording';
                 btn.style.background = '#444';
                 status.innerText = \`Saved: \${file}\`;
                 status.style.color = '#10b981';
                 sendEvent('ACTION', 'Recording Stopped');

             }
        };

        // Listen for Pill Stop Button
        window.addEventListener('atlas-stop-recording', () => {
            if (isRecording) stopRecording();
        });

        // Listen for Pause
        window.addEventListener('atlas-toggle-pause', (e) => {
            if (!isRecording) return;
            const isPaused = e.detail.paused;
            if (window.atlasTogglePause) window.atlasTogglePause(isPaused);
            
            if (isPaused) {
                status.innerText = 'Status: ⏸ Paused';
                status.style.color = '#f59e0b';
            } else {
                status.innerText = 'Status: ● Recording...';
                status.style.color = '#ff4444';
            }
        });

        container.appendChild(btn);

        container.appendChild(status);
        return container;
    });

})();
`;
