
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
            window.location.reload();
        };

        container.appendChild(reloadBtn);

        return container;
    });
})();
`;
