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
      console.log(`${userId} ist jetzt Mitglied von ${result.room_id ?? roomId}.`);
    } catch (err) {
      const isNonPublic =
        err.status === 403 && (/restricted room/i.test(err.message) || /not `public`/i.test(err.message));

      if (isNonPublic) {
        throw new Error(
          `${roomId} ist nicht oeffentlich (restricted oder privat) und kann per Admin-API nicht direkt betreten ` +
            'werden. Weder "!admin users force-join-room" noch "!admin users force-promote" koennen das umgehen ' +
            '(beide laufen durch dieselbe Join-Pruefung). Es hilft nur ein regulaerer Invite durch ein bestehendes ' +
            'Mitglied des Raums.'
        );
      }

      throw err;
    }
  } catch (err) {
    console.error(`Fehler beim Beitreten von ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
