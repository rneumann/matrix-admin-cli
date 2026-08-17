import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function userDeactivateCommand(userId, options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const result = await client.deactivateUser(userId, { erase: options.erase });
    console.log(`Benutzer deaktiviert: ${userId}`);
    console.log(result);
  } catch (err) {
    console.error(`Fehler beim Deaktivieren von ${userId}: ${err.message}`);
    process.exitCode = 1;
  }
}
