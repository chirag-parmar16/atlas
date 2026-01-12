
export const INSPECTOR = `
// inspector.js
(function () {
    let isInspecting = false;
    let selectedOverlay = null;
    let tooltip = null;
    let inspectDetails = null; // Container for details

    function createOverlay(borderColor, backgroundColor) {
        const node = document.createElement('div');
        node.style.position = 'fixed';
        node.style.border = '1px solid ' + borderColor;
        node.style.backgroundColor = backgroundColor;
        node.style.pointerEvents = 'none';
        node.style.zIndex = '2147483646';
        node.style.transition = 'all 0.1s';
        node.style.display = 'none';
        document.body.appendChild(node);
        return node;
    }

    function getSelectedOverlay() {
        if (!selectedOverlay) selectedOverlay = createOverlay('rgba(16, 185, 129, 1)', 'transparent');
        return selectedOverlay;
    }

    function getTooltip() {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.style.position = 'fixed';
            tooltip.style.background = '#333';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '4px 8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.fontFamily = 'monospace';
            tooltip.style.zIndex = '2147483647';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.display = 'none';
            tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    function updateHighlight(el) {
        const rect = el.getBoundingClientRect();
        const ol = getSelectedOverlay();

        ol.style.top = rect.top + 'px';
        ol.style.left = rect.left + 'px';
        ol.style.width = rect.width + 'px';
        ol.style.height = rect.height + 'px';
        ol.style.display = 'block';

        const tt = getTooltip();
        tt.innerHTML = '<span style="color:#10b981">' + el.tagName.toLowerCase() + '</span><span style="color:#9ca3af">.' + (el.className.split(' ')[0] || '') + '</span> <span style="color:#aaa;margin-left:4px">' + Math.round(rect.width) + 'x' + Math.round(rect.height) + '</span>';
        let top = rect.top - 30;
        if (top < 0) top = rect.bottom + 10;
        tt.style.top = top + 'px';
        tt.style.left = rect.left + 'px';
        tt.style.display = 'block';
    }

    function selectElement(el) {
        if (!el || !inspectDetails) return;
        updateHighlight(el);

        const path = [];
        let curr = el;
        while (curr && curr.tagName !== 'BODY' && path.length < 5) {
            path.unshift(curr);
            curr = curr.parentElement;
        }
        // if (curr === document.body) path.unshift(document.body); // Check simplified

        const breadcrumbsHtml = path.map(node =>
            '<span class="crumb" style="cursor:pointer;color:' + (node === el ? '#fff' : '#888') + ';margin-right:4px;">' +
                node.tagName.toLowerCase() +
                '<span style="color:#555">&gt;</span>' +
              '</span>'
        ).join('');

        const computed = window.getComputedStyle(el);
        const p = (name) => computed.getPropertyValue(name);


        // Attributes
        let attrsHtml = '<div style="margin-bottom:12px;font-weight:bold;color:#eee;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Attributes</div>';
        if (el.attributes.length > 0) {
            Array.from(el.attributes).forEach(attr => {
                attrsHtml += '<div class="prop-row"><span class="prop-label">' + attr.name + '</span> <span class="prop-val" style="color:#a5b4fc">' + attr.value + '</span></div>';
            });
        } else {
             attrsHtml += '<div style="color:#666;font-style:italic;">None</div>';
        }

        // Styles (Computed)
        const stylesToShow = ['color', 'background-color', 'font-family', 'font-size', 'margin', 'padding', 'border', 'display', 'position', 'z-index'];
        let stylesHtml = '<div style="margin-top:12px;margin-bottom:12px;font-weight:bold;color:#eee;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Computed Styles</div>';
        stylesToShow.forEach(key => {
            const val = p(key);
            if (val && val !== 'none' && val !== '0px' && val !== 'auto' && val !== 'normal' && val !== 'rgba(0, 0, 0, 0)') {
                stylesHtml += '<div class="prop-row"><span class="prop-label">' + key + '</span> <span class="prop-val">' + val + '</span></div>';
            }
        });

        // Content (Text)
        let contentHtml = '<div style="margin-top:12px;margin-bottom:12px;font-weight:bold;color:#eee;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">Content</div>';
        const text = el.innerText ? el.innerText.trim() : '';
        if (text) {
             const shortText = text.length > 100 ? text.substring(0, 100) + '...' : text;
             contentHtml += '<div style="font-family:monospace; color:#d1d5db; word-break:break-word; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px;">' + shortText + '</div>';
        } else {
             contentHtml += '<div style="color:#666;font-style:italic;">Empty / Media</div>';
        }

        inspectDetails.innerHTML = 
          '<div style="font-size:12px;font-family:monospace;margin-bottom:12px;white-space:nowrap;overflow-x:auto;padding-bottom:4px;">' + breadcrumbsHtml + '</div>' +
          '<div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;margin-bottom:12px;">' +
            '<div style="font-weight:bold;color:#10b981;font-size:14px;margin-bottom:4px">' + el.tagName.toLowerCase() + '</div>' +
            '<div style="font-size:11px;color:#aaa;font-family:monospace">#' + (el.id || '—') + '</div>' +
            '<div style="font-size:11px;color:#aaa;font-family:monospace">.' + (Array.from(el.classList).join('.') || '—') + '</div>' +
          '</div>' +
          attrsHtml + 
          stylesHtml +
          '<div class="prop-row"><span class="prop-label">Dimensions</span> <span class="prop-val">' + el.offsetWidth + ' x ' + el.offsetHeight + ' px</span></div>' +
          contentHtml;

        // Re-attach clicks
        setTimeout(() => {
            const crumbs = inspectDetails.querySelectorAll('.crumb');
            crumbs.forEach((c, idx) => {
                c.onclick = () => selectElement(path[idx]);
            });
        }, 0);
    }

    function onClick(e) {
        // Allow clicks inside Atlas Tools
        const host = document.getElementById('atlas-tools-host');
        if (host && (e.target === host || host.contains(e.target))) return;

        // Stop default action inside iframe
        e.preventDefault();
        e.stopPropagation();
    }

    function onDblClick(e) {
        e.preventDefault();
        e.stopPropagation();
        selectElement(e.target);
    }

    window.Atlas.addTool('Audit', function () {
        host = document.getElementById('atlas-tools-host');

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';

        // Additional Styles
        const style = document.createElement('style');
        style.textContent = \`
            .inspector-details { font-size: 12px; color: #ccc; }
            .prop-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .prop-label { color: #888; }
            .prop-val { color: #fff; font-family: monospace; }
        \`;
        container.appendChild(style);

        const ICONS = {
            SEARCH: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
        };

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'action-btn';
        toggleBtn.innerHTML = \`<span style="display:flex; align-items:center; justify-content:center; gap:6px;">\${ICONS.SEARCH} Toggle Inspect Mode</span>\`;
        toggleBtn.style.textAlign = 'center';
        toggleBtn.style.marginBottom = '10px';

        // --- CHANGED LOGIC START ---
        const getAppDoc = () => {
             return document;
        };

        toggleBtn.onclick = () => {
            isInspecting = !isInspecting;
            const appDoc = getAppDoc();
            
            if (!appDoc) {
                alert('Application frame not ready yet.');
                return;
            }

            if (isInspecting) {
                toggleBtn.style.border = '1px solid #10b981';
                toggleBtn.innerHTML = \`<span style="display:flex; align-items:center; justify-content:center; gap:6px;">\${ICONS.SEARCH} Inspect Mode (Active)</span>\`;
                toggleBtn.style.color = '#10b981';
                
                // Target the IFRAME document
                appDoc.addEventListener('click', onClick, true);
                appDoc.addEventListener('dblclick', onDblClick, true);
                appDoc.body.style.cursor = 'crosshair'; 
            } else {
                toggleBtn.style.border = '1px solid rgba(255,255,255,0.1)';
                toggleBtn.innerHTML = \`<span style="display:flex; align-items:center; justify-content:center; gap:6px;">\${ICONS.SEARCH} Inspect Mode (Off)</span>\`;
                toggleBtn.style.color = '#ccc';
                
                appDoc.removeEventListener('click', onClick, true);
                appDoc.removeEventListener('dblclick', onDblClick, true);
                appDoc.body.style.cursor = ''; 
                
                if (selectedOverlay) selectedOverlay.style.display = 'none';
                if (tooltip) tooltip.style.display = 'none';
            }
        };
        // --- CHANGED LOGIC END ---

        const scrollArea = document.createElement('div');
        scrollArea.style.flex = '1';
        scrollArea.style.overflowY = 'auto';

        inspectDetails = document.createElement('div');
        inspectDetails.className = 'inspector-details';
        inspectDetails.innerHTML = '<div style="text-align:center;color:#666;margin-top:20px">Double-Click elements in the app to Inspect</div>';

        scrollArea.appendChild(inspectDetails);
        container.appendChild(toggleBtn);
        container.appendChild(scrollArea);

        return container;
    });
})();
`;