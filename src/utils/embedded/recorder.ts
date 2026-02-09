
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

    // --- Interaction Tracking ---

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



    // Event tracking logic stays but tab is removed as it's now in Extras
})();
`;
