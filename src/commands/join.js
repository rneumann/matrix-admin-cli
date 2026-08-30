// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { toFullUserId } from '../userId.js';

export async function joinCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const roomId = await client.resolveRoomId(roomIdOrAlias);
    const userId = options.user ? toFullUserId(options.user, config.serverName) : (await client.whoami()).user_id;

    try {
      const result = await client.joinRoom(roomId, userId);
      console.log(`${userId} is now a member of ${result.room_id ?? roomId}.`);
    } catch (err) {
      const isNonPublic =
        err.status === 403 && (/restricted room/i.test(err.message) || /not `public`/i.test(err.message));

      if (isNonPublic) {
        throw new Error(
          `${roomId} is not public (restricted or private) and cannot be joined directly via the admin API. ` +
            'Neither "!admin users force-join-room" nor "!admin users force-promote" can work around this ' +
            '(both go through the same join check). Only a regular invite from an existing member of the room helps.'
        );
      }

      throw err;
    }
  } catch (err) {
    console.error(`Failed to join ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
