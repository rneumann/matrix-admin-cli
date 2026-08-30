// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function deleteCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const roomId = await client.resolveRoomId(roomIdOrAlias);

    if (!options.yes) {
      throw new Error(
        `Deleting ${roomIdOrAlias} (${roomId}) is permanent (purge). Add --yes to confirm.`
      );
    }

    await client.deleteRoom(roomId);
    console.log(`${roomIdOrAlias} (${roomId}) was deleted.`);
  } catch (err) {
    console.error(`Failed to delete ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
