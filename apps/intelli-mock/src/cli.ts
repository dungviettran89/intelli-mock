#!/usr/bin/env node

import { Command } from 'commander';
import { registerStartCommand } from './commands/start.js';
import { registerInitCommand } from './commands/init.js';

const program = new Command();

program
  .name('intelli-mock')
  .description('AI-powered API mocking platform for teams')
  .version('0.0.0');

// Register commands
registerInitCommand(program);
registerStartCommand(program);

program.parse();
