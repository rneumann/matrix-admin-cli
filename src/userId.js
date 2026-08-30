// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

export function toFullUserId(idOrLocalpart, serverName) {
  return idOrLocalpart.startsWith('@') ? idOrLocalpart : `@${idOrLocalpart}:${serverName}`;
}
