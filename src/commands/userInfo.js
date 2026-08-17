import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

function toFullUserId(idOrLocalpart, serverName) {
  return idOrLocalpart.startsWith('@') ? idOrLocalpart : `@${idOrLocalpart}:${serverName}`;
}

/**
 * Aggregiert Name, Berechtigungen, Raeume und Spaces eines Benutzers aus
 * mehreren Synapse-Admin-API-Aufrufen zu einer Uebersicht.
 * Raeume/Spaces werden als canonical_alias ausgegeben (Fallback: room_id,
 * falls kein canonical_alias gesetzt ist).
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
  const rooms = [];
  const spaces = [];

  for (const roomId of joined.joined_rooms ?? []) {
    const info = roomsById.get(roomId);
    const alias = info?.canonical_alias ?? roomId;
    (info?.room_type === 'm.space' ? spaces : rooms).push(alias);
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
    for (const alias of overview.rooms) console.log(`  - ${alias}`);

    console.log(`Spaces (${overview.spaces.length}):`);
    for (const alias of overview.spaces) console.log(`  - ${alias}`);
  } catch (err) {
    console.error(`Fehler beim Abrufen der Benutzer-Uebersicht: ${err.message}`);
    process.exitCode = 1;
  }
}
