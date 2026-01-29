export const LINKS = `
// links.js
(function () {
    console.log('[Atlas] Initializing Link Auditor...');
    
    const auditLinks = async () => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const internalLinks = links.filter(a => {
            try {
                const url = new URL(a.href);
                return url.hostname === window.location.hostname;
            } catch (e) { return false; }
        });

        if (internalLinks.length === 0) return;

        // Dedup
        const uniqueLinks = Array.from(new Set(internalLinks.map(a => a.href)));
        
        console.log(\`[Atlas Auditor] Scanning \${uniqueLinks.length} internal links...\`);

        for (const link of uniqueLinks) {
            try {
                const res = await fetch(link, { method: 'HEAD' });
                if (res.status === 404 || res.status >= 500) {
                    const atlas = window.Atlas;
                    if (atlas) {
                        atlas.reportViolation('Audit', \`Broken internal link: \${new URL(link).pathname} (\${res.status})\`, 2);
                    }
                }
            } catch (e) {
                // Network error or blocked
            }
        }
    };

    // Run once on load
    if (document.readyState === 'complete') auditLinks();
    else window.addEventListener('load', auditLinks);

    // Re-audit on SPA navigation (approximate)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(auditLinks, 2000); // Wait for hydration
        }
    }).observe(document, { subtree: true, childList: true });
})();
`;
