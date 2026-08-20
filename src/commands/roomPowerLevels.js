import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function roomPowerLevelsCommand(roomId, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const resolvedRoomId = await client.resolveRoomId(roomId);

    if (options.user) {
      const level = await client.getUserPowerLevel(resolvedRoomId, options.user);
      console.log(`Power-Level von ${options.user} in ${roomId}: ${level}`);
      return;
    }

    const levels = await client.getRoomPowerLevels(resolvedRoomId);
    console.log(levels);
  } catch (err) {
    console.error(`Fehler beim Abrufen der Power-Levels von ${roomId}: ${err.message}`);
    process.exitCode = 1;
  }
}
