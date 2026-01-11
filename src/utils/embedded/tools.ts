
export const TOOLS = `
// tools.js
(function () {
    window.Atlas.addTool('Utils', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'action-btn';
        reloadBtn.innerText = '↻ Reload Project';
        reloadBtn.onclick = () => {
            const frame = document.getElementById('project-view');
            if (frame) frame.contentWindow.location.reload();
        };

        const clearStorageBtn = document.createElement('button');
        clearStorageBtn.className = 'action-btn';
        clearStorageBtn.innerText = '🗑 Clear Project Storage';
        clearStorageBtn.onclick = () => {
             // We can't easily clear cross-origin iframe storage from here due to security.
             // But since we are same-origin (proxied), we might be able to access it.
             const frame = document.getElementById('project-view');
             if (frame) {
                 try {
                     const win = frame.contentWindow;
                     win.localStorage.clear();
                     win.sessionStorage.clear();
                     win.document.cookie.split(";").forEach((c) => {
                        win.document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                     });
                     win.location.reload();
                     alert('Project Storage Cleared');
                 } catch (e) {
                     alert('Cannot clear storage: Cross-Origin restriction? ' + e.message);
                 }
             }
        };

        container.appendChild(reloadBtn);
        container.appendChild(clearStorageBtn);

        return container;
    });
})();
`;
