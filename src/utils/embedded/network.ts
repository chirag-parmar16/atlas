export const NETWORK = `
// network.js
(function () {
    console.log('[Atlas] Initializing Network Tool...');
    let renderList = null;
    let detailView = null;
    let selectedRow = null;
    const requestDataMap = new Map();

    const createRow = (r) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.style.borderBottom = '1px solid #333';
        row.style.fontSize = '11px';
        row.style.fontFamily = 'Consolas, Monaco, monospace';
        row.style.color = '#ccc';
        
        row.onmouseover = () => { if (selectedRow !== row) row.style.background = '#2a2d3e'; };
        row.onmouseout = () => { if (selectedRow !== row) row.style.background = 'transparent'; };

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
        const u = r.url.toLowerCase();
        if (u.endsWith('.js')) return 'Script';
        if (u.endsWith('.css')) return 'CSS';
        if (u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.svg')) return 'Img';
        return 'Other';
    };

    const addRequest = (data) => {
        if (requestDataMap.has(data.id)) return;
        requestDataMap.set(data.id, data);

        if (renderList) {
            const tbody = renderList.querySelector('tbody');
            if (tbody) {
                const newRow = createRow(data);
                tbody.appendChild(newRow);
                
                // Memory Leak Fix: Cap requests
                if (tbody.children.length > 500) {
                    tbody.removeChild(tbody.firstChild);
                }

                if (renderList.scrollTop + renderList.clientHeight >= renderList.scrollHeight - 50) {
                     renderList.scrollTop = renderList.scrollHeight;
                }
            }
        }
    };

    const renderJSON = (data) => {
        const type = typeof data;
        if (data === null) return \`<span class="net-val-null">null</span>\`;
        if (type === 'string') return \`<span class="net-val-string">"\${data}"</span>\`;
        if (type === 'number') return \`<span class="net-val-num">\${data}</span>\`;
        if (type === 'boolean') return \`<span class="net-val-bool">\${data}</span>\`;
        if (type === 'object') {
            const isArray = Array.isArray(data);
            const keys = Object.keys(data);
            if (keys.length === 0) return isArray ? '[]' : '{}';
            let html = \`<details open><summary>\${isArray ? \`[\${keys.length}]\` : \`{\${keys.length}}\`}</summary>\`;
            keys.forEach(key => {
                html += \`<div><span class="net-key">\${key}:</span> \${renderJSON(data[key])}</div>\`;
            });
            html += '</details>';
            return html;
        }
        return String(data);
    };

    const renderDetails = (r) => {
        if (!detailView) return;
        detailView.innerHTML = '';
        detailView.style.background = '#1e1e1e';
        detailView.style.display = 'flex';
        detailView.style.flexDirection = 'column';

        // 1. TABS
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'net-tabs';
        ['Headers', 'Preview', 'Response'].forEach((name, idx) => {
             const t = document.createElement('div');
             t.className = \`net-tab \${idx === 0 ? 'active' : ''}\`;
             t.innerText = name;
             t.onclick = () => {
                 tabsContainer.querySelectorAll('.net-tab').forEach(el => el.classList.remove('active'));
                 t.classList.add('active');
                 detailView.querySelectorAll('.net-panel').forEach(el => el.classList.remove('active'));
                 detailView.querySelector(\`#net-panel-\${name}\`).classList.add('active');
             };
             tabsContainer.appendChild(t);
        });
        detailView.appendChild(tabsContainer);

        // 2. CONTENT CONTAINER
        const contentContainer = document.createElement('div');
        contentContainer.style.flex = '1';
        contentContainer.style.overflow = 'auto'; // Scrollable content

        // --- PANEL: HEADERS ---
        const pHeaders = document.createElement('div');
        pHeaders.id = 'net-panel-Headers';
        pHeaders.className = 'net-panel active';
        pHeaders.style.padding = '10px';

        const createSection = (title, data) => {
           const div = document.createElement('div');
           div.style.marginBottom = '12px';
           div.innerHTML = \`<div style="font-weight:bold; color:#ccc; border-bottom:1px solid #333; margin-bottom:4px;">\${title}</div>\`;
           
           if (typeof data === 'string') {
               div.innerHTML += \`<div style="font-family:monospace; color:#aaa;">\${data}</div>\`;
           } else {
               const table = document.createElement('table');
               table.style.width = '100%'; table.style.fontSize = '11px';
               for (const [k, v] of Object.entries(data)) {
                   const tr = document.createElement('tr');
                   tr.innerHTML = \`<td style="vertical-align:top; color:#888; padding-right:8px; white-space:nowrap;">\${k}:</td><td style="color:#ddd; word-break:break-all;">\${v}</td>\`;
                   table.appendChild(tr);
               }
               div.appendChild(table);
           }
           return div;
        };
        
        pHeaders.appendChild(createSection('General', {
            'Request URL': r.url,
            'Request Method': r.method,
            'Status Code': r.status,
            'Time': r.time + 'ms'
        }));
        pHeaders.appendChild(createSection('Response Headers', r.resHeaders));
        pHeaders.appendChild(createSection('Request Headers', r.reqHeaders));
        contentContainer.appendChild(pHeaders);

        // --- PANEL: PREVIEW ---
        const pPreview = document.createElement('div');
        pPreview.id = 'net-panel-Preview';
        pPreview.className = 'net-panel';
        
        try {
            const parsed = JSON.parse(r.body);
            pPreview.innerHTML = \`<div class="net-json-tree">\${renderJSON(parsed)}</div>\`;
        } catch (e) {
            pPreview.innerHTML = \`<div style="padding:10px; color:#aaa; font-style:italic;">Not a JSON response</div>\`;
        }
        contentContainer.appendChild(pPreview);

        // --- PANEL: RESPONSE ---
        const pResponse = document.createElement('div');
        pResponse.id = 'net-panel-Response';
        pResponse.className = 'net-panel';
        pResponse.innerHTML = \`<pre style="margin:0; padding:10px; white-space:pre-wrap; word-break:break-all; font-family:Consolas,monospace; font-size:11px; color:#ddd;">\${r.body.replace(/</g,'&lt;')}</pre>\`;
        contentContainer.appendChild(pResponse);

        detailView.appendChild(contentContainer);
    };

    window.Atlas.addTool('Traffic', function () {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.background = '#1e1e1e';

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
            if (window.clearNetworkHistory) window.clearNetworkHistory();
        };

        const throttleSelect = document.createElement('select');
        throttleSelect.style.background = '#252526';
        throttleSelect.style.color = '#ccc';
        throttleSelect.style.border = '1px solid #333';
        throttleSelect.style.borderRadius = '4px';
        throttleSelect.style.padding = '2px 4px';
        throttleSelect.style.fontSize = '11px';
        throttleSelect.style.marginRight = '8px';
        throttleSelect.style.outline = 'none';

        ['No Throttling', 'Fast 4G', 'Slow 4G', 'Offline'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            throttleSelect.appendChild(opt);
        });

        const savedProfile = sessionStorage.getItem('atlas-throttle-profile');
        if (savedProfile) {
            throttleSelect.value = savedProfile;
            setTimeout(() => { if (window.setThrottling) window.setThrottling(savedProfile); }, 500);
        }

        throttleSelect.onchange = () => {
             const val = throttleSelect.value;
             sessionStorage.setItem('atlas-throttle-profile', val);
             if (window.setThrottling) window.setThrottling(val);
        };

        const rightControls = document.createElement('div');
        rightControls.appendChild(throttleSelect);
        rightControls.appendChild(clearBtn);

        toolBar.appendChild(label);
        toolBar.appendChild(rightControls);
        container.appendChild(toolBar);

        // --- INSIGHTS SUMMARY ---
        const insightsBar = document.createElement('div');
        insightsBar.style.display = 'grid';
        insightsBar.style.gridTemplateColumns = '1fr 1fr 1fr';
        insightsBar.style.gap = '10px';
        insightsBar.style.padding = '10px';
        insightsBar.style.borderBottom = '1px solid #333';
        insightsBar.style.background = '#1a1a1a';
        container.appendChild(insightsBar);

        const createInsightCard = (title, color) => {
            const card = document.createElement('div');
            card.style.borderLeft = '3px solid ' + color;
            card.style.paddingLeft = '8px';
            card.style.fontSize = '10px';
            card.innerHTML = '<div style="color:#888">' + title + '</div><div class="count" style="font-size:16px; font-weight:bold; color:'+color+'">0</div>';
            insightsBar.appendChild(card);
            return card;
        };

        const secCard = createInsightCard('Security Leaks', '#ef4444');
        const perfCard = createInsightCard('Perf Issues', '#fca130');
        const linkCard = createInsightCard('Broken Links', '#fca130');

        const updateInsightCounts = () => {
            const violations = (window as any).Atlas?.violations || [];
            secCard.querySelector('.count').innerText = violations.filter(v => v.type === 'Security Warden').length;
            perfCard.querySelector('.count').innerText = violations.filter(v => v.type === 'Performance').length;
            linkCard.querySelector('.count').innerText = violations.filter(v => v.type === 'Audit').length;
        };

        setInterval(updateInsightCounts, 1000);

        const split = document.createElement('div');
        split.style.flex = '1';
        split.style.display = 'flex';
        split.style.flexDirection = 'column';
        split.style.overflow = 'hidden';

        renderList = document.createElement('div');
        renderList.style.flex = '1'; 
        renderList.style.overflow = 'auto';
        renderList.style.position = 'relative';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.tableLayout = 'fixed';

        const thead = document.createElement('thead');
        thead.innerHTML = \`
            <tr style="background:#252526; color:#ccc; text-align:left; font-size:11px;">
                <th style="padding:4px; border-bottom:1px solid #333;">Name</th>
                <th style="padding:4px; width:40px; border-bottom:1px solid #333;">Status</th>
                <th style="padding:4px; width:40px; border-bottom:1px solid #333;">Method</th>
                <th style="padding:4px; width:50px; border-bottom:1px solid #333;">Type</th>
                <th style="padding:4px; width:50px; text-align:right; border-bottom:1px solid #333;">Time</th>
            </tr>
            <style>
               /* Shared JSON Tree CSS */
               .net-json-tree { font-family: monospace; font-size: 11px; padding: 10px; }
               .net-json-tree details { margin-left: 14px; }
               .net-json-tree summary { cursor: pointer; color: #a5b4fc; outline: none; }
               .net-json-tree summary:hover { color: #818cf8; }
               .net-key { color: #e0e0e0; }
               .net-val-string { color: #a5d6a7; }
               .net-val-num { color: #f48fb1; }
               .net-val-bool { color: #90caf9; }
               .net-val-null { color: #9e9e9e; }
               /* Tabs */
               .net-tabs { display: flex; border-bottom: 1px solid #333; background: #252526; }
               .net-tab { padding: 6px 12px; cursor: pointer; font-size: 11px; color:#aaa; border-right: 1px solid #333; }
               .net-tab:hover { background: #333; color: #fff; }
               .net-tab.active { background: #1e1e1e; color: #10b981; font-weight: bold; border-bottom: 2px solid #10b981; }
               .net-panel { display: none; padding: 0; }
               .net-panel.active { display: block; }
            </style>
        \`;
        
        const tbody = document.createElement('tbody');
        table.appendChild(thead);
        table.appendChild(tbody);
        renderList.appendChild(table);

        const resizer = document.createElement('div');
        resizer.style.height = '4px';
        resizer.style.background = '#333';
        resizer.style.cursor = 'ns-resize';

        detailView = document.createElement('div');
        detailView.style.height = '200px'; 
        detailView.style.overflow = 'auto';
        detailView.style.borderTop = '1px solid #333';

        split.appendChild(renderList);
        split.appendChild(resizer);
        split.appendChild(detailView);
        container.appendChild(split);

        if (requestDataMap.size > 0) {
            requestDataMap.forEach(r => tbody.appendChild(createRow(r)));
            setTimeout(() => { renderList.scrollTop = renderList.scrollHeight; }, 10);
        }

        // [FIX] Improved History Binding with no spam
        let attempts = 0;
        let historyLoaded = false;

        const fetchHistory = async () => {
             // @ts-ignore
             if (window.getNetworkHistory) {
                  try {
                      // @ts-ignore
                      const hist = await window.getNetworkHistory();
                      if (hist && hist.length > 0) {
                          hist.forEach(d => addRequest(d));
                      }
                      historyLoaded = true;
                  } catch (e) {}
             }
        };

        const flushQueue = async () => {
             // 1. Flush Immediate Queue
             // @ts-ignore
             const queue = window.__ATLAS_NETWORK_QUEUE__ || [];
             if (queue.length > 0) {
                 queue.forEach(d => addRequest(d));
                 // @ts-ignore
                 window.__ATLAS_NETWORK_QUEUE__ = []; 
             }
             
             // 2. Fetch History (Once initially)
             if (!historyLoaded) await fetchHistory();

             // Continue polling for queue updates (Infinite)
             setTimeout(flushQueue, 500);
        };

        // Listen for Navigation Changes (User Request: Reload Network on Nav)
        window.addEventListener('message', (event) => {
             if (event.data && event.data.type === 'ATLAS_URL_CHANGE') {
                 // console.log('[Atlas Network] Navigation detected. Syncing history...');
                 fetchHistory();
             }
        });
        
        setTimeout(flushQueue, 100);

        return container;
    });

    window.Atlas.logNetworkRequest = (data) => {
        // console.log('[Atlas Network] Received Live Log:', data.id);
        addRequest(data);
    };
})();
`;