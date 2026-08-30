// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function whoamiCommand() {
  const config = requireConfig();
  const client = new MatrixClient(config);

  console.log(`Homeserver:  ${config.homeserverUrl}`);
  console.log(`Server-Name: ${config.serverName}`);

  try {
    const result = await client.whoami();
    console.log(result);
  } catch (err) {
    console.error(`Fehler beim Verbindungstest: ${err.message}`);
    process.exitCode = 1;
  }
}
