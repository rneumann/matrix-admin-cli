import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function deleteCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const roomId = await client.resolveRoomId(roomIdOrAlias);

    if (!options.yes) {
      throw new Error(
        `Das Loeschen von ${roomIdOrAlias} (${roomId}) ist unwiderruflich (purge). Zur Bestaetigung --yes anhaengen.`
      );
    }

    await client.deleteRoom(roomId);
    console.log(`${roomIdOrAlias} (${roomId}) wurde geloescht.`);
  } catch (err) {
    console.error(`Fehler beim Loeschen von ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
