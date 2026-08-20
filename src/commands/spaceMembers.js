import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function spaceMembersCommand(spaceId) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const roomId = await client.resolveRoomId(spaceId);
    const result = await client.getRoomMembers(roomId);
    console.log(`Mitglieder von ${spaceId} (${result.total ?? result.members?.length ?? 0}):`);
    console.log(result.members ?? result);
  } catch (err) {
    console.error(`Fehler beim Abrufen der Mitglieder von ${spaceId}: ${err.message}`);
    process.exitCode = 1;
  }
}
