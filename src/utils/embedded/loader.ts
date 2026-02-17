export const LOADER = `
(() => {
    if (window.__ATLAS_LOADER_INJECTED) return;
    window.__ATLAS_LOADER_INJECTED = true;

    const style = document.createElement('style');
    style.textContent = \`
        #atlas-loader-overlay {
            position: fixed;
            inset: 0;
            background: radial-gradient(circle at center, #05070d 0%, #000 80%);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', sans-serif;
            overflow: hidden;
        }

        /* Subtle scan lines */
        #atlas-loader-overlay::before {
            content: "";
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(
                to bottom,
                rgba(255,255,255,0.03),
                rgba(255,255,255,0.03) 1px,
                transparent 1px,
                transparent 3px
            );
            pointer-events: none;
        }

        .atlas-core {
            position: relative;
            width: 264px; /* 220 * 1.2 */
            height: 264px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Outer rotating segmented ring */
        .atlas-ring {
            position: absolute;
            width: 240px; /* 200 * 1.2 */
            height: 240px;
            border-radius: 50%;
            border: 2px solid rgba(57, 255, 20, 0.15); /* Neon Green Opacity */
        }

        .atlas-ring::after {
            content: "";
            position: absolute;
            inset: -2px;
            border-radius: 50%;
            border: 2px solid transparent;
            border-top: 2px solid #39ff14; /* Neon Green */
            border-right: 2px solid #39ff14;
            animation: spin 2s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        /* Inner pulse core */
        .atlas-pulse {
            position: absolute;
            width: 144px; /* 120 * 1.2 */
            height: 144px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(57, 255, 20, 0.4) 0%, transparent 70%);
            animation: pulse 2.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%,100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 1; }
        }

        /* ATLAS text */
        .atlas-text {
            position: relative;
            font-size: 32px; /* 26 * 1.2 */
            letter-spacing: 8px;
            font-weight: 700;
            color: #39ff14; /* Neon Green */
            font-style: italic; /* Italian style */
            text-shadow: 0 0 12px rgba(57, 255, 20, 0.8);
        }

        /* System initializing text */
        .atlas-status {
            position: absolute;
            bottom: -50px;
            font-size: 14px;
            letter-spacing: 2px;
            color: rgba(57, 255, 20, 0.6);
            animation: blink 1.4s infinite;
        }

        @keyframes blink {
            0%,100% { opacity: 0.4; }
            50% { opacity: 1; }
        }
    \`;

    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'atlas-loader-overlay';

    overlay.innerHTML = \`
        <div class="atlas-core">
            <div class="atlas-ring"></div>
            <div class="atlas-pulse"></div>
            <div class="atlas-text">ATLAS</div>
            <div class="atlas-status">INITIALIZING SENDBOX...</div>
        </div>
    \`;

    document.documentElement.appendChild(overlay);
})();
`;
