import { requireConfig } from '../config.js';
import { MatrixClient } from '../matrixClient.js';

export async function spaceListCommand(options) {
  const config = requireConfig();
  const client = new MatrixClient(config);

  try {
    const result = await client.listSpaces({
      limit: options.limit,
      search_term: options.search,
    });
    console.log(`Spaces (${result.total ?? result.rooms?.length ?? 0}):`);
    console.log(result.rooms ?? result);
  } catch (err) {
    console.error(`Fehler beim Abrufen der Space-Liste: ${err.message}`);
    process.exitCode = 1;
  }
}
