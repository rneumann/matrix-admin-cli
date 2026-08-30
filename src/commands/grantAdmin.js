// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export function buildTargetClient(config) {
  if (!config.targetUser || !config.targetPassword) {
    throw new Error(
      'MATRIX_TARGET_USER and MATRIX_TARGET_PASSWORD must be set in .env ' +
        '(the account that should receive admin rights in rooms).'
    );
  }
  return new MatrixClient({
    homeserverUrl: config.homeserverUrl,
    adminUser: config.targetUser,
    adminPassword: config.targetPassword,
    serverName: config.serverName,
  });
}

/**
 * Makes targetUserId an admin (power level) in a room:
 * 1. adminClient (already a member with sufficient power) sends an invite.
 * 2. targetClient (its own account) accepts the invite.
 * 3. adminClient sets the power level.
 * Fails if adminClient itself has no access to the room.
 */
export async function grantAdminForRoom(adminClient, targetClient, roomId, targetUserId, level) {
  try {
    await adminClient.inviteToRoom(roomId, targetUserId);
  } catch (err) {
    const alreadyInRoom = /already in the room|already joined|is joined or banned/i.test(err.message);
    if (!alreadyInRoom) throw err;
  }

  await targetClient.selfJoinRoom(roomId);
  await adminClient.setUserPowerLevel(roomId, targetUserId, level);
}

export async function grantAdminCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const adminClient = new MatrixClient(config);

  try {
    const targetClient = buildTargetClient(config);
    const roomId = await adminClient.resolveRoomId(roomIdOrAlias);
    const targetUserId = (await targetClient.whoami()).user_id;
    const level = options.level ? Number(options.level) : 100;

    await grantAdminForRoom(adminClient, targetClient, roomId, targetUserId, level);
    console.log(`${targetUserId} is now an admin (power level ${level}) in ${roomId}.`);
  } catch (err) {
    console.error(`Admin grant failed for ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
