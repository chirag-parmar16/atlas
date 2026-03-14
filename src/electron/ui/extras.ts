declare global {
    interface Window {
        Atlas: any;
        startNativeRecording: () => Promise<boolean>;
    }
}

(function () {
    let containerEl: HTMLElement | null = null;

    const ICONS = {
        VIDEO: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        RELOAD: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>'
    };

    const renderRecorder = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'background:rgba(255,255,255,0.03); padding:24px; border-radius:12px; border:1px solid rgba(255,255,255,0.06); text-align:center; margin-bottom:16px;';

        header.innerHTML = '<div style="color:#ef4444; margin-bottom:16px; display:flex; justify-content:center;">' + ICONS.VIDEO + '</div>' +
            '<div style="font-weight:800; color:#fff; font-size:16px; margin-bottom:10px; letter-spacing:0.5px;">Session Recorder</div>' +
            '<div style="font-size:12px; color:#a1a1aa; line-height:1.6; margin-bottom:24px; max-width:280px; margin-left:auto; margin-right:auto;">Capture high-fidelity diagnostic video of user interactions and network events.</div>';

        const btn = document.createElement('button');
        btn.style.cssText = 'width:100%; padding:14px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; transition:all 0.2s; box-shadow:0 8px 16px rgba(239, 68, 68, 0.2); text-transform:uppercase; letter-spacing:1px;';
        btn.innerText = 'START RECORDING';
        btn.onmouseover = () => { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 10px 20px rgba(239, 68, 68, 0.25)'; };
        btn.onmouseout = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 8px 16px rgba(239, 68, 68, 0.2)'; };
        btn.onclick = async () => {
            let started = false;
            try {
                if (typeof window.startNativeRecording === 'function') {
                    started = await window.startNativeRecording();
                }
            } catch (e) { console.error('[Atlas] Native recording failed to start:', e); }

            if (started) {
                btn.innerText = 'RECORDING ACTIVE';
                btn.style.background = '#71717a';
                btn.style.boxShadow = 'none';
            } else {
                btn.innerText = 'START FAILED';
                setTimeout(() => { btn.innerText = 'START RECORDING'; }, 2000);
            }
        };
        header.appendChild(btn);
        containerEl.appendChild(header);

        const utils = document.createElement('div');
        utils.style.cssText = 'background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:10px;';
        utils.innerHTML = '<div style="font-size:10px; color:#52525b; margin-bottom:12px; text-align:center; font-weight:800; letter-spacing:2px; text-transform:uppercase;">Utilities</div>';

        const reloadBtn = document.createElement('button');
        reloadBtn.style.cssText = 'width:100%; padding:12px; background:rgba(255,255,255,0.04); color:#e4e4e7; border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:11px; cursor:pointer; transition:all 0.2s; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;';
        reloadBtn.innerHTML = ICONS.RELOAD + ' FORCE RELOAD PROJECT';
        reloadBtn.onmouseover = () => { reloadBtn.style.background = 'rgba(255,255,255,0.08)'; };
        reloadBtn.onmouseout = () => { reloadBtn.style.background = 'rgba(255,255,255,0.04)'; };
        reloadBtn.onclick = () => window.location.reload();
        utils.appendChild(reloadBtn);
        containerEl.appendChild(utils);
    };

    window.Atlas.addTool('Extras', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:20px; display:flex; flex-direction:column; height:100%; background:transparent; justify-content:center;';
        renderRecorder();
        return containerEl;
    }, renderRecorder);
})();
export { };

