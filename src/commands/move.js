// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function moveCommand(roomIdOrAlias, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    if (!options.to && !options.topLevel) {
      throw new Error('Please specify --to <space> or --top-level.');
    }
    if (options.to && options.topLevel) {
      throw new Error('--to and --top-level cannot be given at the same time.');
    }

    const roomId = await client.resolveRoomId(roomIdOrAlias);
    const toSpaceId = options.to ? await client.resolveRoomId(options.to) : null;
    const fromSpaceId = options.from ? await client.resolveRoomId(options.from) : null;

    const { removedFrom, addedTo } = await client.moveNode(roomId, { toSpaceId, fromSpaceId });

    for (const parentId of removedFrom) {
      console.log(`Removed from space ${parentId}.`);
    }

    if (addedTo) {
      console.log(`${roomIdOrAlias} placed into space ${options.to} (${addedTo}).`);
    } else {
      console.log(`${roomIdOrAlias} is now at the top level (no parent space anymore).`);
    }
  } catch (err) {
    console.error(`Failed to move ${roomIdOrAlias}: ${err.message}`);
    process.exitCode = 1;
  }
}
