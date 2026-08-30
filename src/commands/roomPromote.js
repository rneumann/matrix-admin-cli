// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { toFullUserId } from '../userId.js';

export async function roomPromoteCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    if (!config.adminRoomId) {
      throw new Error(
        'MATRIX_ADMIN_ROOM_ID (room ID of the server admin room) is not set, please add it to .env.'
      );
    }

    const roomId = await client.resolveRoomId(roomIdOrAlias);
    const userId = options.user ? toFullUserId(options.user, config.serverName) : (await client.whoami()).user_id;

    console.log(`Sending force-promote for ${userId} in ${roomId}...`);
    await client.forcePromoteIntoRoom(userId, roomId, config.adminRoomId);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const level = await client.getUserPowerLevel(roomId, userId);
    console.log(`Power level of ${userId} in ${roomId}: ${level}`);
  } catch (err) {
    console.error(`Force-promote failed in ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
