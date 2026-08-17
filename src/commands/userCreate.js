import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function userCreateCommand(localpart, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);
  const userId = `@${localpart}:${config.serverName}`;

  try {
    const result = await client.createUser(userId, {
      password: options.password,
      admin: options.admin,
    });
    console.log(`Benutzer angelegt/aktualisiert: ${userId}`);
    console.log(result);
  } catch (err) {
    console.error(`Fehler beim Anlegen von ${userId}: ${err.message}`);
    process.exitCode = 1;
  }
}
