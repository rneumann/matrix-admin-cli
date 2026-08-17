#!/usr/bin/env node
import { buildCli } from '../src/cli.js';

const program = buildCli();
program.parseAsync(process.argv);
