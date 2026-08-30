// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { toFullUserId } from '../userId.js';

/**
 * Aggregates a user's name, permissions, rooms and spaces from several
 * Synapse Admin API calls into a single overview.
 * Rooms/spaces are returned as { name, "power-level" } objects: name is
 * the canonical_alias (fallback: room_id), "power-level" is the user's
 * effective power level in that room (from m.room.power_levels).
 *
 * @param {MatrixClient} client
 * @param {string} idOrLocalpart e.g. "testuser" or "@testuser:matrix.example.org"
 * @param {string} serverName fallback domain if only a localpart is given
 */
export async function getUserOverview(client, idOrLocalpart, serverName) {
  const userId = toFullUserId(idOrLocalpart, serverName);

  const [user, joined, { rooms: allRooms = [] }] = await Promise.all([
    client.getUser(userId),
    client.getJoinedRooms(userId),
    client.listRooms({ limit: 1000 }),
  ]);

  const roomsById = new Map(allRooms.map((room) => [room.room_id, room]));
  const joinedRoomIds = joined.joined_rooms ?? [];

  const entries = await Promise.all(
    joinedRoomIds.map(async (roomId) => {
      const info = roomsById.get(roomId);
      const name = info?.canonical_alias ?? roomId;
      const powerLevel = await client.getUserPowerLevel(roomId, userId);
      return { name, powerLevel, isSpace: info?.room_type === 'm.space' };
    })
  );

  const rooms = [];
  const spaces = [];
  for (const entry of entries) {
    (entry.isSpace ? spaces : rooms).push({ name: entry.name, 'power-level': entry.powerLevel });
  }

  return {
    user_id: userId,
    name: user.displayname ?? null,
    admin: Boolean(user.admin),
    deactivated: Boolean(user.deactivated),
    locked: Boolean(user.locked),
    rooms,
    spaces,
  };
}

export async function userInfoCommand(idOrLocalpart, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const overview = await getUserOverview(client, idOrLocalpart, config.serverName);

    if (options.json) {
      console.log(JSON.stringify(overview, null, 2));
      return;
    }

    console.log(`User:         ${overview.user_id}`);
    console.log(`Name:         ${overview.name ?? '(no display name)'}`);
    console.log(`Server admin: ${overview.admin ? 'yes' : 'no'}`);
    console.log(`Deactivated:  ${overview.deactivated ? 'yes' : 'no'}`);
    console.log(`Locked:       ${overview.locked ? 'yes' : 'no'}`);

    console.log(`Rooms (${overview.rooms.length}):`);
    for (const room of overview.rooms) {
      console.log(`  - ${room.name} (power level: ${room['power-level']})`);
    }

    console.log(`Spaces (${overview.spaces.length}):`);
    for (const space of overview.spaces) {
      console.log(`  - ${space.name} (power level: ${space['power-level']})`);
    }
  } catch (err) {
    console.error(`Failed to fetch user overview: ${err.message}`);
    process.exitCode = 1;
  }
}
