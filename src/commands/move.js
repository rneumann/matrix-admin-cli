import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function moveCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    if (!options.to && !options.topLevel) {
      throw new Error('Bitte --to <space> oder --top-level angeben.');
    }
    if (options.to && options.topLevel) {
      throw new Error('--to und --top-level koennen nicht gleichzeitig angegeben werden.');
    }

    const roomId = await client.resolveRoomId(roomIdOrAlias);
    const toSpaceId = options.to ? await client.resolveRoomId(options.to) : null;
    const fromSpaceId = options.from ? await client.resolveRoomId(options.from) : null;

    const { removedFrom, addedTo } = await client.moveNode(roomId, { toSpaceId, fromSpaceId });

    for (const parentId of removedFrom) {
      console.log(`Aus Space ${parentId} entfernt.`);
    }

    if (addedTo) {
      console.log(`${roomIdOrAlias} in Space ${options.to} (${addedTo}) eingeordnet.`);
    } else {
      console.log(`${roomIdOrAlias} ist jetzt auf Toplevel-Ebene (kein Eltern-Space mehr).`);
    }
  } catch (err) {
    console.error(`Fehler beim Verschieben von ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
