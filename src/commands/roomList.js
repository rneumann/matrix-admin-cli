// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function roomListCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const result = await client.listRooms({
      limit: options.limit,
      search_term: options.search,
    });
    console.log(`Rooms (${result.total ?? result.rooms?.length ?? 0}):`);
    console.log(result.rooms ?? result);
  } catch (err) {
    console.error(`Failed to fetch room list: ${err.message}`);
    process.exitCode = 1;
  }
}
