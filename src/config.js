import 'dotenv/config';

function stripTrailingSlash(url) {
  return url?.replace(/\/+$/, '');
}

export function loadConfig() {
  const homeserverUrl = stripTrailingSlash(process.env.MATRIX_HOMESERVER_URL);
  const adminUser = process.env.MATRIX_ADMIN_USER;
  const adminPassword = process.env.MATRIX_ADMIN_PASSWORD;
  const serverName = process.env.MATRIX_SERVER_NAME;
  const adminRoomId = process.env.MATRIX_ADMIN_ROOM_ID;
  const targetUser = process.env.MATRIX_TARGET_USER;
  const targetPassword = process.env.MATRIX_TARGET_PASSWORD;

  return { homeserverUrl, adminUser, adminPassword, serverName, adminRoomId, targetUser, targetPassword };
}

export function requireConfig() {
  const config = loadConfig();
  const missing = [];

  if (!config.homeserverUrl) missing.push('MATRIX_HOMESERVER_URL');
  if (!config.adminUser) missing.push('MATRIX_ADMIN_USER');
  if (!config.adminPassword) missing.push('MATRIX_ADMIN_PASSWORD');
  if (!config.serverName) missing.push('MATRIX_SERVER_NAME');

  if (missing.length > 0) {
    console.error(`Fehlende Konfiguration: ${missing.join(', ')}`);
    console.error('Bitte .env anlegen (siehe .env.example).');
    process.exit(1);
  }

  return config;
}
