import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function spaceIsMemberCommand(spaceId, userId) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const roomId = await client.resolveRoomId(spaceId);
    const isMember = await client.isRoomMember(roomId, userId);
    console.log(
      isMember
        ? `${userId} ist Mitglied von ${spaceId}`
        : `${userId} ist NICHT Mitglied von ${spaceId}`
    );
    process.exitCode = isMember ? 0 : 1;
  } catch (err) {
    console.error(`Fehler bei der Mitgliedschaftspruefung: ${err.message}`);
    process.exitCode = 2;
  }
}
