// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';
import { promptHidden } from '../promptHidden.js';
import { toFullUserId } from '../userId.js';

export async function userCheckPasswordCommand(idOrLocalpart, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);
  const userId = toFullUserId(idOrLocalpart, config.serverName);

  const password =
    options.password ??
    process.env.MATRIX_CHECK_PASSWORD ??
    (await promptHidden(`Passwort fuer ${userId}: `));

  try {
    const result = await client.checkPassword(userId, password);
    if (result.valid) {
      console.log(`Passwort fuer ${userId} ist GUELTIG.`);
      process.exitCode = 0;
    } else {
      console.log(`Passwort fuer ${userId} ist UNGUELTIG (${result.reason}).`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Fehler bei der Passwortpruefung: ${err.message}`);
    process.exitCode = 2;
  }
}
