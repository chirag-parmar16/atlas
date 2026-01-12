import fs from 'fs';
import path from 'path';

export async function init() {
    const projectPath = process.cwd();
    const configPath = path.join(projectPath, 'atlas.config.json');

    // Check if config already exists
    if (fs.existsSync(configPath)) {
        console.log('\n\x1b[33m[Atlas] atlas.config.json already exists in this directory.\x1b[0m');
        console.log('If you want to reset it, delete the existing file and run init again.\n');
        return;
    }

    // Create default config
    const defaultConfig = {
        startupTimeout: 30000,
        recordingEnabled: true,
        debugMode: false
    };

    try {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
        console.log('\n\x1b[32m✓ Successfully initialized Atlas!\x1b[0m');
        console.log(`\nCreated: \x1b[36m${configPath}\x1b[0m`);
        console.log('\nDefault configuration:');
        console.log('  • Startup timeout: 30 seconds');
        console.log('  • Recording: Enabled');
        console.log('  • Debug mode: Disabled');
        console.log('\nYou can now run: \x1b[36matlas run\x1b[0m\n');
    } catch (error) {
        console.error('\n\x1b[31m[Error] Failed to create atlas.config.json:\x1b[0m', (error as Error).message);
        process.exit(1);
    }
}
