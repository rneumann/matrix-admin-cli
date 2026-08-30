// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

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
    console.error(`Missing configuration: ${missing.join(', ')}`);
    console.error('Please create a .env file (see .env.example).');
    process.exit(1);
  }

  return config;
}

/**
 * Like requireConfig(), but without MATRIX_ADMIN_USER/PASSWORD - for the
 * web UI, where users authenticate against the homeserver themselves per
 * session via a login form instead of using a fixed admin account.
 */
export function requireHomeserverConfig() {
  const config = loadConfig();
  const missing = [];

  if (!config.homeserverUrl) missing.push('MATRIX_HOMESERVER_URL');
  if (!config.serverName) missing.push('MATRIX_SERVER_NAME');

  if (missing.length > 0) {
    console.error(`Missing configuration: ${missing.join(', ')}`);
    console.error('Please create a .env file (see .env.example).');
    process.exit(1);
  }

  return config;
}
