(function () {
    const formatTime = () => new Date().toISOString().split('T')[1].split('.')[0];
    let isRecording = false;
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
            } catch (e) { break; }
        }
        isSending = false;
    };

    const sendEvent = (type, details) => {
        if (!isRecording) return;
        eventQueue.push({ time: formatTime(), url: window.location.pathname, type, details });
        processQueue();
    };

    setInterval(processQueue, 1000);

    window.addEventListener('atlas-recording-state', (e) => {
        isRecording = e.detail.active;
    });

    const isInteractive = (el) => {
        if (!el) return false;
        const tag = el.tagName;
        if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'].includes(tag)) return true;
        return window.getComputedStyle(el).cursor === 'pointer';
    };

    const getLabel = (el) => {
        return el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'Element';
    };

    document.addEventListener('click', (e) => {
        if (e.target.closest('#atlas-floating-window')) return;
        let clickable = e.target.closest('a, button, input, select, textarea, [role="button"]');
        if (!clickable && !isInteractive(e.target)) return;
        clickable = clickable || e.target;
        let label = getLabel(clickable);
        if (label.length > 50) label = label.substring(0, 47) + '...';
        sendEvent('ACTION', { tag: clickable.tagName, label: label.trim(), id: clickable.id });
    }, true);

    document.addEventListener('change', (e) => {
        const t = e.target;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
            sendEvent('INPUT', { tag: t.tagName, label: getLabel(t).trim(), value: t.value });
        }
    }, true);
})();
export {};
