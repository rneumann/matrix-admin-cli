// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function joinAllCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const { user_id: userId } = await client.whoami();
    const rooms = await client.listAllRooms({});

    console.log(`${rooms.length} rooms/spaces found.`);
    console.log(options.dryRun ? `[dry-run] would join ${userId} to:` : `Joining ${userId} to...`);

    let joined = 0;
    let failed = 0;

    for (const room of rooms) {
      const label = room.name || room.canonical_alias || room.room_id;

      if (options.dryRun) {
        console.log(`  - ${label} (${room.room_id})`);
        continue;
      }

      try {
        await client.joinRoom(room.room_id, userId);
        joined += 1;
        console.log(`OK   ${label} (${room.room_id})`);
      } catch (err) {
        failed += 1;
        console.error(`FAIL ${label} (${room.room_id}): ${err.message}`);
      }
    }

    if (!options.dryRun) {
      console.log(`Done: ${joined} joined, ${failed} failed.`);
      if (failed > 0) process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Failed to join all rooms/spaces: ${err.message}`);
    process.exitCode = 1;
  }
}
