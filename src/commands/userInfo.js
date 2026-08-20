import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { toFullUserId } from '../userId.js';

/**
 * Aggregiert Name, Berechtigungen, Raeume und Spaces eines Benutzers aus
 * mehreren Synapse-Admin-API-Aufrufen zu einer Uebersicht.
 * Raeume/Spaces werden als { name, "power-level" }-Objekte ausgegeben: name
 * ist der canonical_alias (Fallback: room_id), "power-level" der effektive
 * Power-Level des Benutzers in diesem Raum (aus m.room.power_levels).
 *
 * @param {MatrixClient} client
 * @param {string} idOrLocalpart z.B. "womi0003" oder "@womi0003:matrix.h-ka.de"
 * @param {string} serverName Fallback-Domain, falls nur ein Localpart uebergeben wird
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

    console.log(`Benutzer:     ${overview.user_id}`);
    console.log(`Name:         ${overview.name ?? '(kein Displayname)'}`);
    console.log(`Server-Admin: ${overview.admin ? 'ja' : 'nein'}`);
    console.log(`Deaktiviert:  ${overview.deactivated ? 'ja' : 'nein'}`);
    console.log(`Gesperrt:     ${overview.locked ? 'ja' : 'nein'}`);

    console.log(`Raeume (${overview.rooms.length}):`);
    for (const room of overview.rooms) {
      console.log(`  - ${room.name} (Power-Level: ${room['power-level']})`);
    }

    console.log(`Spaces (${overview.spaces.length}):`);
    for (const space of overview.spaces) {
      console.log(`  - ${space.name} (Power-Level: ${space['power-level']})`);
    }
  } catch (err) {
    console.error(`Fehler beim Abrufen der Benutzer-Uebersicht: ${err.message}`);
    process.exitCode = 1;
  }
}
