// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function userListCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const result = await client.listUsers({ limit: options.limit });
    console.log(`Users (${result.total ?? result.users?.length ?? 0}):`);
    console.log(result.users ?? result);
  } catch (err) {
    console.error(`Failed to fetch user list: ${err.message}`);
    process.exitCode = 1;
  }
}
