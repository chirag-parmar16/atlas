import { CLOSER_CSS } from '../styles/closer.css';

export function buildCloserScript(): string {
    return `
(function () {
    const inject = () => {
        if (!document.head || !document.body) {
            setTimeout(inject, 50);
            return;
        }

        if (document.getElementById('atlas-closer-overlay')) return;

        const style = document.createElement('style');
        style.id = 'atlas-closer-styles';
        style.textContent = \`${CLOSER_CSS}\`;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'atlas-closer-overlay';
        el.innerHTML = '<div class="atlas-closer-circle"></div>' +
            '<div class="atlas-closer-title">SHUTTING DOWN</div>' +
            '<div class="atlas-closer-msg">Saving telemetry and generating audit report...</div>';
        
        document.body.appendChild(el);
        
        requestAnimationFrame(() => {
            el.style.opacity = '1';
        });
    };

    inject();
})();
`;
}

export const CLOSER = buildCloserScript();
