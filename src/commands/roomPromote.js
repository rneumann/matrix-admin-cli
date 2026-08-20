import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { toFullUserId } from '../userId.js';

export async function roomPromoteCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    if (!config.adminRoomId) {
      throw new Error(
        'MATRIX_ADMIN_ROOM_ID (Room-ID des Server-Admin-Rooms) ist nicht gesetzt, bitte in der .env ergaenzen.'
      );
    }

    const roomId = await client.resolveRoomId(roomIdOrAlias);
    const userId = options.user ? toFullUserId(options.user, config.serverName) : (await client.whoami()).user_id;

    console.log(`Sende force-promote fuer ${userId} in ${roomId}...`);
    await client.forcePromoteIntoRoom(userId, roomId, config.adminRoomId);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const level = await client.getUserPowerLevel(roomId, userId);
    console.log(`Power-Level von ${userId} in ${roomId}: ${level}`);
  } catch (err) {
    console.error(`Fehler beim Force-Promote in ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
