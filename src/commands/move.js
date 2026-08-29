import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

function label(room, fallbackId) {
  return room?.name || room?.canonical_alias || fallbackId;
}

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
    const targetSpaceId = options.to ? await client.resolveRoomId(options.to) : null;

    if (targetSpaceId) {
      if (targetSpaceId === roomId) {
        throw new Error('Ein Raum/Space kann nicht in sich selbst verschoben werden.');
      }
      if (await client.isDescendant(roomId, targetSpaceId)) {
        throw new Error(
          `${options.to} ist (direkt oder transitiv) bereits ein Kind von ${roomIdOrAlias} - das Verschieben ` +
            'wuerde einen Zyklus in der Space-Hierarchie erzeugen.'
        );
      }
    }

    let parents;
    if (options.from) {
      const fromId = await client.resolveRoomId(options.from);
      parents = [{ room_id: fromId }];
    } else {
      parents = await client.findParentSpaces(roomId);
    }

    for (const parent of parents) {
      if (targetSpaceId && parent.room_id === targetSpaceId) continue;

      await client.removeSpaceChild(parent.room_id, roomId);
      console.log(`Aus Space ${label(parent, parent.room_id)} (${parent.room_id}) entfernt.`);

      try {
        await client.removeSpaceParent(roomId, parent.room_id);
      } catch {
        // m.space.parent im Kind ist nur informativ, Fehler hier sind unkritisch
      }
    }

    if (targetSpaceId) {
      await client.addSpaceChild(targetSpaceId, roomId);
      console.log(`${roomIdOrAlias} in Space ${options.to} (${targetSpaceId}) eingeordnet.`);

      try {
        await client.setSpaceParent(roomId, targetSpaceId);
      } catch {
        // m.space.parent im Kind ist nur informativ, Fehler hier sind unkritisch
      }
    } else {
      console.log(`${roomIdOrAlias} ist jetzt auf Toplevel-Ebene (kein Eltern-Space mehr).`);
    }
  } catch (err) {
    console.error(`Fehler beim Verschieben von ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
