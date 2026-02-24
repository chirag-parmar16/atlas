const fs = require('fs');
const path = require('path');
const tools = [
    'application', 'console', 'extras', 'links', 'networks',
    'recorder', 'security-monitor', 'stability', 'storage'
];

tools.forEach(tool => {
    const src = path.join('src', 'ui', 'components', tool + '.ts');
    const dest = path.join('src', 'electron', 'ui', tool + '.ts');

    if (!fs.existsSync(src)) {
        console.log('Skipping ' + tool + ', not found in src/ui/components');
        return;
    }

    let code = fs.readFileSync(src, 'utf8');

    // Extract everything inside return ` ... `;
    const match = code.match(/return `([\s\S]*?)`;/);
    if (match && match[1]) {
        let extracted = match[1].trim();

        // Remove style literal interpolations like ${escapedCSS}
        extracted = extracted.replace(/\$\{([^}]*)\}/g, '/* $1 styles migrated to renderer.css */');

        fs.writeFileSync(dest, extracted);
        console.log('Migrated ' + tool);
    } else {
        console.log('Failed to match ' + tool);
    }
});
