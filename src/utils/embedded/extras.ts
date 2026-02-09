
export const EXTRAS = `
// extras.js
(function () {
    window.Atlas.addTool('Extras', function () {
        const container = document.createElement('div');
        container.style.padding = '10px';
        container.style.color = '#ccc';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '15px';

        const ICONS = {
             REC: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" color="#ef4444"><circle cx="12" cy="12" r="10"></circle></svg>',
             FILE: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
             REFRESH: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>'
        };

        // 1. AUTOMATED REPORTING INFO
        const reportSection = document.createElement('div');
        reportSection.style.padding = '15px';
        reportSection.style.textAlign = 'center';
        reportSection.style.color = '#71717a';
        reportSection.style.fontSize = '12px';
        reportSection.style.lineHeight = '1.6';
        reportSection.style.background = 'rgba(255,255,255,0.03)';
        reportSection.style.borderRadius = '8px';
        reportSection.innerHTML = \`
            <div style="font-size: 24px; margin-bottom: 10px;">📊</div>
            <strong>Automated Reporting Active</strong><br>
            Journeys and violations are recorded in real-time.<br>
            <span style="color: #10b981;">atlas-audit-report.md</span> is generated on exit.
        \`;
        container.appendChild(reportSection);

        // 2. Session Recording
        const recSection = document.createElement('div');
        recSection.innerHTML = '<div style="font-weight:bold; color:#fff; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">Session Recording</div>';
        
        const recBtn = document.createElement('button');
        recBtn.className = 'action-btn';
        recBtn.style.width = '100%';
        recBtn.innerHTML = ICONS.REC + ' Start New Recording';
        
        let isRec = false;

        recBtn.onclick = async () => {
             if (!isRec) {
                 if (window.atlasStartRecording) {
                     const success = await window.atlasStartRecording();
                     if (success) {
                         isRec = true;
                         window.Atlas.setRecordingState(true);
                         recBtn.innerHTML = '<span style="color:#ef4444">Stop Recording</span>';
                     }
                 }
             } else {
                 if (window.atlasStopRecording) {
                     await window.atlasStopRecording();
                     isRec = false;
                     window.Atlas.setRecordingState(false);
                     recBtn.innerHTML = ICONS.REC + ' Start New Recording';
                 }
             }
        };

        window.addEventListener('atlas-stop-recording', () => {
            isRec = false;
            window.Atlas.setRecordingState(false);
            recBtn.innerHTML = ICONS.REC + ' Start New Recording';
        });

        recSection.appendChild(recBtn);
        container.appendChild(recSection);

        // 3. Project Utils
        const utilSection = document.createElement('div');
        utilSection.innerHTML = '<div style="font-weight:bold; color:#fff; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:8px;">Project Utilities</div>';
        
        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'action-btn';
        reloadBtn.style.width = '100%';
        reloadBtn.style.marginBottom = '8px';
        reloadBtn.innerHTML = ICONS.REFRESH + ' Force Reload Project';
        reloadBtn.onclick = () => { window.location.reload(); };

        utilSection.appendChild(reloadBtn);
        container.appendChild(utilSection);

        return container;
    });
}) ();
`;
