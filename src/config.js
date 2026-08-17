import 'dotenv/config';

function stripTrailingSlash(url) {
  return url?.replace(/\/+$/, '');
}

export function loadConfig() {
  const homeserverUrl = stripTrailingSlash(process.env.MATRIX_HOMESERVER_URL);
  const adminToken = process.env.MATRIX_ADMIN_TOKEN;
  const serverName = process.env.MATRIX_SERVER_NAME;

  return { homeserverUrl, adminToken, serverName };
}

export function requireConfig() {
  const config = loadConfig();
  const missing = [];

  if (!config.homeserverUrl) missing.push('MATRIX_HOMESERVER_URL');
  if (!config.adminToken) missing.push('MATRIX_ADMIN_TOKEN');
  if (!config.serverName) missing.push('MATRIX_SERVER_NAME');

  if (missing.length > 0) {
    console.error(`Fehlende Konfiguration: ${missing.join(', ')}`);
    console.error('Bitte .env anlegen (siehe .env.example).');
    process.exit(1);
  }

  return config;
}
