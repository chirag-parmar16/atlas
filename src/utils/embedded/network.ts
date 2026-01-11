export const NETWORK = `
// network.js
(function () {
    console.log('[Atlas] Initializing Network Tool...');
    let renderList = null;
    let detailView = null;
    let selectedRow = null;
    const requestDataMap = new Map();

    // Use a table layout for the "Real DevTools" look
    const createRow = (r) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.style.borderBottom = '1px solid #333';
        row.style.fontSize = '11px';
        row.style.fontFamily = 'Consolas, Monaco, monospace';
        row.style.color = '#ccc';
        
        // Row Hover
        row.onmouseover = () => { if (selectedRow !== row) row.style.background = '#2a2d3e'; };
        row.onmouseout = () => { if (selectedRow !== row) row.style.background = 'transparent'; };

        // Click Handler
        row.onclick = () => {
            if (selectedRow) selectedRow.style.background = 'transparent';
            selectedRow = row;
            row.style.background = '#3e4451';
            renderDetails(r);
        };

        const name = r.url.split('/').pop() || r.url || '/';
        const type = inferType(r);
        
        let statusColor = '#ddd';
        if (r.status >= 200 && r.status < 300) statusColor = '#49cc90'; // Green
        else if (r.status >= 300 && r.status < 400) statusColor = '#fca130'; // Orange
        else if (r.status >= 400) statusColor = '#f93e3e'; // Red
        else if (r.status === 'ERR') statusColor = '#f93e3e';

        // Violation Check
        if (r.status >= 400) {
            const level = r.status >= 500 ? window.Atlas.Severity.ERROR : window.Atlas.Severity.WARN;
            window.Atlas.reportViolation('Traffic', \`\${r.status} \${r.method} \${name}\`, level);
        }

        row.innerHTML = \`
            <td style="padding:4px; white-space:nowrap; max-width: 150px; overflow:hidden; text-overflow:ellipsis;" title="\${r.url}">\${name}</td>
            <td style="padding:4px; text-align:center; color:\${statusColor}">\${r.status}</td>
            <td style="padding:4px; text-align:center;">\${r.method}</td>
            <td style="padding:4px; text-align:center; color:#aaa;">\${type}</td>
            <td style="padding:4px; text-align:right;">\${r.time}ms</td>
        \`;
        
        return row;
    };

    const inferType = (r) => {
        if (r.resHeaders && r.resHeaders['content-type']) {
            const ct = r.resHeaders['content-type'];
            if (ct.includes('html')) return 'Doc';
            if (ct.includes('javascript') || ct.includes('js')) return 'Script';
            if (ct.includes('css')) return 'CSS';
            if (ct.includes('image')) return 'Img';
            if (ct.includes('font')) return 'Font';
            if (ct.includes('json')) return 'Fetch';
        }
        // Fallback to extension
        const u = r.url.toLowerCase();
        if (u.endsWith('.js')) return 'Script';
        if (u.endsWith('.css')) return 'CSS';
        if (u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.svg')) return 'Img';
        return 'Other';
    };

    const addRequest = (data) => {
        // Prevent dupes if same ID (rare but possible with queue)
        if (requestDataMap.has(data.id)) {
            // console.log('[Network] Duplicate ID ignored:', data.id);
            return;
        }
        requestDataMap.set(data.id, data);

        if (renderList) {
            const tbody = renderList.querySelector('tbody');
            if (tbody) {
                const newRow = createRow(data);
                // Prepend or Append? DevTools usually Appends logic (newest at bottom)
                // usage: appendChild (Standard)
                tbody.appendChild(newRow);
                
                // Auto-scroll to bottom
                if (renderList.scrollTop + renderList.clientHeight >= renderList.scrollHeight - 50) {
                     renderList.scrollTop = renderList.scrollHeight;
                }
            } else {
                console.warn('[Network] Render failed: tbody not found');
            }
        } else {
            console.log('[Network] Cached request (Tab hidden):', data.url);
        }
    };

    const renderDetails = (r) => {
        if (!detailView) return;
        detailView.innerHTML = '';
        detailView.style.background = '#222'; // distinct bg

        const createSection = (title, content) => {
           const div = document.createElement('div');
           div.style.marginBottom = '12px';
           const h = document.createElement('div');
           h.innerText = title;
           h.style.fontWeight = 'bold';
           h.style.borderBottom = '1px solid #444';
           h.style.marginBottom = '4px';
           h.style.color = '#bbb';
           div.appendChild(h);
           
           const pre = document.createElement('pre');
           pre.style.margin = '0';
           pre.style.whiteSpace = 'pre-wrap';
           pre.style.wordBreak = 'break-all';
           pre.style.fontFamily = 'Consolas, monospace';
           pre.style.fontSize = '11px';
           pre.style.color = '#ddd';
           pre.innerText = content;
           div.appendChild(pre);
           return div;
        };

        const jsonFormat = (str) => {
             try { return JSON.stringify(JSON.parse(str), null, 2); } catch (e) { return str; }
        };

        const container = document.createElement('div');
        container.style.padding = '10px';
        
        container.appendChild(createSection('General', \`Request URL: \${r.url}\\nRequest Method: \${r.method}\\nStatus Code: \${r.status}\\nTime: \${r.time}ms\`));
        container.appendChild(createSection('Response Headers', JSON.stringify(r.resHeaders, null, 2)));
        container.appendChild(createSection('Request Headers', JSON.stringify(r.reqHeaders, null, 2)));
        const bodyContent = jsonFormat(r.body);
        const bodySection = createSection('Response Body', bodyContent);
        
        // Add Copy Button to Response Body Header
        const header = bodySection.querySelector('div'); // The header div created in createSection
        if (header) {
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';

            const copyBtn = document.createElement('span');
            copyBtn.innerText = 'Copy';
            copyBtn.style.fontSize = '10px';
            copyBtn.style.color = '#49cc90';
            copyBtn.style.cursor = 'pointer';
            copyBtn.style.marginLeft = '10px';
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(bodyContent).then(() => {
                   const original = copyBtn.innerText;
                   copyBtn.innerText = 'Copied!';
                   setTimeout(() => copyBtn.innerText = original, 1000);
                });
            };
            header.appendChild(copyBtn);
        }
        container.appendChild(bodySection);

        detailView.appendChild(container);
    };

    window.Atlas.addTool('Traffic', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.background = '#1e1e1e';

        // Header / Toolbar
        const toolBar = document.createElement('div');
        toolBar.style.padding = '4px 8px';
        toolBar.style.borderBottom = '1px solid #333';
        toolBar.style.display = 'flex';
        toolBar.style.justifyContent = 'space-between';
        
        const label = document.createElement('span');
        label.innerText = 'Network';
        label.style.fontWeight = 'bold';
        label.style.color = '#ccc';
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '&oslash;';
        clearBtn.title = 'Clear';
        clearBtn.style.background = 'transparent';
        clearBtn.style.border = 'none';
        clearBtn.style.color = '#aaa';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.fontSize = '14px';
        clearBtn.onclick = () => { 
            const tbody = renderList.querySelector('tbody');
            if (tbody) tbody.innerHTML = '';
            detailView.innerHTML = '';
            requestDataMap.clear();
        };

        // Throttling Dropdown
        const throttleSelect = document.createElement('select');
        throttleSelect.style.background = '#252526';
        throttleSelect.style.color = '#ccc';
        throttleSelect.style.border = '1px solid #333';
        throttleSelect.style.borderRadius = '4px';
        throttleSelect.style.padding = '2px 4px';
        throttleSelect.style.fontSize = '11px';
        throttleSelect.style.marginRight = '8px';
        throttleSelect.style.outline = 'none';

        const profiles = ['No Throttling', 'Fast 4G', 'Slow 4G', 'Offline'];
        profiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            throttleSelect.appendChild(opt);
        });

        // Restore Selection
        const savedProfile = sessionStorage.getItem('atlas-throttle-profile');
        if (savedProfile) {
            throttleSelect.value = savedProfile;
            // Re-apply immediately
            setTimeout(() => {
                if (window.setThrottling) window.setThrottling(savedProfile);
            }, 500); // Small delay to ensure bridge is ready
        }

        throttleSelect.onchange = () => {
             const val = throttleSelect.value;
             sessionStorage.setItem('atlas-throttle-profile', val);
             if (window.setThrottling) {
                 window.setThrottling(val);
             } else {
                 console.warn("Throttling bridge not found");
             }
        };

        const rightControls = document.createElement('div');
        rightControls.appendChild(throttleSelect);
        rightControls.appendChild(clearBtn);

        toolBar.appendChild(label);
        toolBar.appendChild(rightControls);
        container.appendChild(toolBar);

        // Split Layout (Top: Table, Bottom: Details)
        const split = document.createElement('div');
        split.style.flex = '1';
        split.style.display = 'flex';
        split.style.flexDirection = 'column';
        split.style.overflow = 'hidden';

        // TABLE
        renderList = document.createElement('div');
        renderList.style.flex = '1'; // Takes 50% height initially
        renderList.style.overflow = 'auto';
        renderList.style.position = 'relative';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.tableLayout = 'fixed'; // Fixed for perf

        const thead = document.createElement('thead');
        thead.innerHTML = \`
            <tr style="background:#252526; color:#ccc; text-align:left; font-size:11px;">
                <th style="padding:4px; border-bottom:1px solid #333;">Name</th>
                <th style="padding:4px; width:40px; border-bottom:1px solid #333;">Status</th>
                <th style="padding:4px; width:40px; border-bottom:1px solid #333;">Method</th>
                <th style="padding:4px; width:50px; border-bottom:1px solid #333;">Type</th>
                <th style="padding:4px; width:50px; text-align:right; border-bottom:1px solid #333;">Time</th>
            </tr>
        \`;
        
        const tbody = document.createElement('tbody');
        table.appendChild(thead);
        table.appendChild(tbody);
        renderList.appendChild(table);

        // RESIZER
        const resizer = document.createElement('div');
        resizer.style.height = '4px';
        resizer.style.background = '#333';
        resizer.style.cursor = 'ns-resize';

        // DETAILS
        detailView = document.createElement('div');
        detailView.style.height = '200px'; // Initial height
        detailView.style.overflow = 'auto';
        detailView.style.borderTop = '1px solid #333';

        split.appendChild(renderList);
        split.appendChild(resizer);
        split.appendChild(detailView);
        container.appendChild(split);

        // --- RESTORE DATA ---
        // Render any requests that were captured while the tab was closed/hidden
        if (requestDataMap.size > 0) {
            const tbody = renderList.querySelector('tbody');
            if (tbody) {
                requestDataMap.forEach(r => {
                     const row = createRow(r);
                     tbody.appendChild(row);
                });
                // Scroll to bottom
                setTimeout(() => {
                     renderList.scrollTop = renderList.scrollHeight;
                }, 10);
            }
        }

        // --- HISTORY RESTORATION & QUEUE FLUSHING ---
        let historyRestored = false;
        
        const restoreHistory = async () => {
             // @ts-ignore
             if (window.getNetworkHistory) {
                 try {
                     // @ts-ignore
                     const history = await window.getNetworkHistory();
                     if (history && Array.isArray(history)) {
                         console.log(\`[Network] Restored \${history.length} requests from history\`);
                         requestDataMap.clear(); 
                         history.forEach(d => addRequest(d));
                         historyRestored = true;
                         return true;
                     }
                 } catch (e) {
                     console.warn('[Network] History fetch error:', e);
                 }
             } else {
                 console.log('[Network] Waiting for History Binding...');
             }
             return false;
        };

        // Poll for both Binding (History) and Queue
        let attempts = 0;
        const flushQueue = async () => {
            // Try to restore history if not done yet
            if (!historyRestored) {
                await restoreHistory();
            }

             // @ts-ignore
             const queue = window.__ATLAS_NETWORK_QUEUE__ || [];
             if (queue.length > 0) {
                 console.log(\`[Network] Flushing \${queue.length} queued requests\`);
                 queue.forEach(d => addRequest(d));
                 // @ts-ignore
                 window.__ATLAS_NETWORK_QUEUE__ = []; // clear
             }
             
             attempts++;
             // Extend polling to 5 seconds to ensure bindings catch up
             if (attempts < 20) setTimeout(flushQueue, 250);
        };
        setTimeout(flushQueue, 100);

        return container;
    });

    // Public API
    window.Atlas.logNetworkRequest = (data) => {
        console.log('[Network] Live Update Received:', data.url, 'ID:', data.id);
        addRequest(data);
    };
})();
`;
