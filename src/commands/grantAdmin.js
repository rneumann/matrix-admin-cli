import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export function buildTargetClient(config) {
  if (!config.targetUser || !config.targetPassword) {
    throw new Error(
      'MATRIX_TARGET_USER und MATRIX_TARGET_PASSWORD muessen in der .env gesetzt sein ' +
        '(Account, der Admin-Rechte in Raeumen erhalten soll).'
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
 * Macht targetUserId zum Admin (Power-Level) in einem Raum:
 * 1. adminClient (bereits Mitglied mit ausreichend Power) laedt ein.
 * 2. targetClient (eigener Account) nimmt die Einladung an.
 * 3. adminClient setzt den Power-Level.
 * Schlaegt fehl, wenn adminClient selbst keinen Zugriff auf den Raum hat.
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
    console.log(`${targetUserId} ist jetzt Admin (Power-Level ${level}) in ${roomId}.`);
  } catch (err) {
    console.error(`Fehler beim Admin-Grant fuer ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
