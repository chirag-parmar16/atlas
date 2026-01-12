#!/usr/bin/env node
import { Command } from 'commander';
import { run } from './src/commands/run';
import { init } from './src/commands/init';

const program = new Command();

program
    .name('atlas')
    .description('Atlas CLI for isolated browser environment testing')
    .version('1.0.0');

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

program.parse(process.argv);
