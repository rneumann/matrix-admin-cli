// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

function formatNode(room, roomId) {
  if (!room) return `${roomId} (unbekannt / nicht auflösbar)`;
  const type = room.room_type === 'm.space' ? '[Space]' : '[Raum]';
  const name = room.name || room.canonical_alias || roomId;
  return `${type} ${name} (${roomId})`;
}

function walk(roomId, prefix, isLast, ancestors, lines, hierarchy) {
  const { byId, childrenMap } = hierarchy;
  const room = byId.get(roomId);
  const connector = isLast ? '└── ' : '├── ';
  const cyclic = ancestors.has(roomId);

  lines.push(prefix + connector + formatNode(room, roomId) + (cyclic ? '  [Zyklus - abgebrochen]' : ''));
  if (cyclic) return;

  const children = childrenMap.get(roomId) ?? [];
  const nextPrefix = prefix + (isLast ? '    ' : '│   ');
  const nextAncestors = new Set(ancestors).add(roomId);

  children.forEach((child, i) => {
    walk(child.roomId, nextPrefix, i === children.length - 1, nextAncestors, lines, hierarchy);
  });
}

function walkRoot(roomId, lines, hierarchy) {
  const { byId, childrenMap } = hierarchy;
  const room = byId.get(roomId);
  lines.push(formatNode(room, roomId));

  const children = childrenMap.get(roomId) ?? [];
  const ancestors = new Set([roomId]);

  children.forEach((child, i) => {
    walk(child.roomId, '', i === children.length - 1, ancestors, lines, hierarchy);
  });
}

export async function spaceTreeCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const hierarchy = await client.getSpaceHierarchy();
    const lines = [];

    if (options.root) {
      const rootId = await client.resolveRoomId(options.root);
      walkRoot(rootId, lines, hierarchy);
    } else {
      for (const id of hierarchy.topLevelIds) {
        walkRoot(id, lines, hierarchy);
      }
    }

    if (lines.length === 0) {
      console.log('Keine Raeume/Spaces gefunden.');
      return;
    }

    console.log(lines.join('\n'));
  } catch (err) {
    console.error(`Fehler beim Erzeugen der Space-Hierarchie: ${err.message}`);
    process.exitCode = 1;
  }
}
