// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { buildTargetClient, grantAdminForRoom } from './grantAdmin.js';

export async function grantAdminAllCommand(options) {
  const config = requireConfig();
  const adminClient = new MatrixClient(config);

  try {
    const targetClient = buildTargetClient(config);
    const targetUserId = (await targetClient.whoami()).user_id;
    const level = options.level ? Number(options.level) : 100;

    const rooms = await adminClient.listAllRooms({});
    console.log(`${rooms.length} Raeume/Spaces gefunden.`);
    console.log(
      options.dryRun
        ? `[dry-run] wuerde ${targetUserId} zum Admin (Power-Level ${level}) machen in:`
        : `Vergebe Admin-Rechte (Power-Level ${level}) an ${targetUserId}...`
    );

    let ok = 0;
    let failed = 0;

    for (const room of rooms) {
      const label = room.name || room.canonical_alias || room.room_id;

      if (options.dryRun) {
        console.log(`  - ${label} (${room.room_id})`);
        continue;
      }

      try {
        await grantAdminForRoom(adminClient, targetClient, room.room_id, targetUserId, level);
        ok += 1;
        console.log(`OK   ${label} (${room.room_id})`);
      } catch (err) {
        failed += 1;
        console.error(`FAIL ${label} (${room.room_id}): ${err.message}`);
      }
    }

    if (!options.dryRun) {
      console.log(`Fertig: ${ok} erfolgreich, ${failed} fehlgeschlagen.`);
      if (failed > 0) process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Fehler beim Admin-Grant fuer alle Raeume: ${err.message}`);
    process.exitCode = 1;
  }
}
