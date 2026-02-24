/**
 * Atlas UI — Links Tab Component (High Fidelity)
 * 
 * Scans the current page for all internal and external links.
 * UPDATED: Fixed rendering visibility bug, added vibrant icons and transparent backgrounds.
 */

export function buildLinksScript(): string {
    return `
(function () {
    let containerEl = null;

    const renderLinks = () => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const links = Array.from(document.querySelectorAll('a[href]'));
        const internal = [], external = [], self = [];
        const domain = window.location.hostname;

        links.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            if (href.startsWith('#') || href.startsWith('javascript:')) self.push(a);
            else if (href.includes(domain) || !href.includes('://')) internal.push(a);
            else external.push(a);
        });

        const createSection = (title, list, color) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:16px; background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); box-shadow:0 4px 12px rgba(0,0,0,0.1);';
            const header = document.createElement('div');
            header.style.cssText = 'font-weight:800; color:#fff; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;';
            header.innerHTML = '<span>' + title + '</span>' +
                '<span style="background:' + color + '33; color:' + color + '; padding:2px 10px; border-radius:12px; font-size:11px; border:1px solid ' + color + '44;">' + list.length + '</span>';
            section.appendChild(header);
            
            const ul = document.createElement('div');
            ul.style.cssText = 'display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; padding-right:4px;';
            
            if (list.length === 0) {
                ul.innerHTML = '<div style="color:#52525b; font-size:11px; font-style:italic; padding:10px; text-align:center;">No links detected.</div>';
            }

            list.forEach(a => {
                const item = document.createElement('div');
                item.style.cssText = 'font-size:11px; color:#ffffff; font-family:"JetBrains Mono", monospace; word-break:break-all; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.03); opacity:0.9;';
                item.innerHTML = '<span style="color:' + color + '; margin-right:8px; font-weight:bold;">→</span>' + a.href.replace(/</g, '&lt;');
                item.title = a.href;
                ul.appendChild(item);
            });
            section.appendChild(ul);
            containerEl.appendChild(section);
        };

        createSection('Internal Links', internal, '#10b981');
        createSection('External Links', external, '#3b82f6');
        createSection('Fragments/Self', self, '#f59e0b');
    };

    window.Atlas.addTool('Links', function () {
        containerEl = document.createElement('div');
        containerEl.style.cssText = 'padding:15px; color:#ffffff; display:flex; flex-direction:column; height:100%; overflow-y:auto; background:transparent; gap:5px;';
        renderLinks();
        return containerEl;
    }, renderLinks);
})();
`;
}

export const LINKS = buildLinksScript();
