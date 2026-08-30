#!/usr/bin/env node
// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { buildCli } from '../src/cli.js';

const program = buildCli();
program.parseAsync(process.argv);
