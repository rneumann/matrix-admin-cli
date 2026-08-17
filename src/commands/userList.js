import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function userListCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const result = await client.listUsers({ limit: options.limit });
    console.log(`Benutzer (${result.total ?? result.users?.length ?? 0}):`);
    console.log(result.users ?? result);
  } catch (err) {
    console.error(`Fehler beim Abrufen der Benutzerliste: ${err.message}`);
    process.exitCode = 1;
  }
}
