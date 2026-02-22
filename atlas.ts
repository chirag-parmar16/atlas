#!/usr/bin/env node
import { Command } from 'commander';
import { run } from './src/cli/run';
import { init } from './src/cli/init';

const program = new Command();
import fs from 'fs';
import path from 'path';

program
    .name('atlas')
    .description('Atlas CLI for isolated browser environment testing')
    .version('1.0.4')
    .option('-d, --disable <tabs>', 'Disable specific UI tabs (comma-separated)')
    .option('-e, --enable <tabs>', 'Enable specific UI tabs (comma-separated)');

const updateConfig = (disable?: string, enable?: string) => {
    const configPath = path.join(process.cwd(), 'atlas.config.json');
    if (!fs.existsSync(configPath)) {
        console.error('\x1b[31m[Error] atlas.config.json not found. Run "atlas init" first.\x1b[0m');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    let disabledTabs: string[] = config.disabledTabs || [];

    // Auto-cleanup legacy space-separated items
    disabledTabs = Array.from(new Set(
        disabledTabs.flatMap(t => t.split(/[,\s]+/))
            .map(t => t.trim().toLowerCase())
            .filter(Boolean)
    ));

    if (disable) {
        const toDisable = disable.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        toDisable.forEach(t => {
            if (!disabledTabs.includes(t)) disabledTabs.push(t);
        });
    }

    if (enable) {
        const toEnable = enable.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        disabledTabs = disabledTabs.filter(t => !toEnable.includes(t));
    }

    config.disabledTabs = disabledTabs;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`\n\x1b[32m✓ Config updated successfully.\x1b[0m`);
    console.log(`  • Status: \x1b[36m${disabledTabs.length > 0 ? 'TABS_DISABLED' : 'ALL_ENABLED'}\x1b[0m`);
    if (disabledTabs.length > 0) {
        console.log(`  • Disabled: \x1b[33m${disabledTabs.join(', ')}\x1b[0m`);
    } else {
        console.log(`  • Disabled: \x1b[33mNone\x1b[0m`);
    }
    console.log('');
};

program
    .command('init')
    .description('Initialize Atlas in the current project directory')
    .action(() => {
        init();
    });

program
    .command('run')
    .description('Run a project in an isolated browser environment with domain masking')
    .action(() => {
        run();
    });

// Manual parsing for top-level flags before commander takes over
const argv = process.argv;
let disableVal: string | undefined;
let enableVal: string | undefined;

for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-d' || argv[i] === '--disable') {
        disableVal = argv[i + 1];
    }
    if (argv[i] === '-e' || argv[i] === '--enable') {
        enableVal = argv[i + 1];
    }
}

const isCommand = argv.some(arg => ['init', 'run', 'help'].includes(arg));

if (disableVal || enableVal) {
    updateConfig(disableVal, enableVal);
    // If no command, exit after update. Otherwise, let commander run the command.
    if (!isCommand) {
        process.exit(0);
    }
}

program.parse(process.argv);

if (!isCommand && !disableVal && !enableVal) {
    program.help();
}
