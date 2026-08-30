// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { MatrixClient } from '../matrixClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', '..', 'public');

const TOKEN_COOKIE = 'matrix_token';
const USER_COOKIE = 'matrix_user';
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' };

function errorMessage(err) {
  return err.data?.error || err.message;
}

/**
 * Converts the Maps returned by getSpaceHierarchy() into a JSON-friendly
 * structure for the frontend. Children that are no longer resolvable on
 * this server (e.g. a foreign homeserver) are included as placeholder
 * nodes with unresolved:true, so the tree still comes out complete.
 */
function serializeHierarchy({ rooms, byId, childrenMap, topLevelIds }) {
  const nodes = {};

  for (const room of rooms) {
    nodes[room.room_id] = {
      room_id: room.room_id,
      name: room.name || null,
      canonical_alias: room.canonical_alias || null,
      room_type: room.room_type || null,
      joined_members: room.joined_members ?? null,
      children: (childrenMap.get(room.room_id) || []).map((c) => c.roomId),
      unresolved: false,
    };
  }

  for (const children of childrenMap.values()) {
    for (const child of children) {
      if (!nodes[child.roomId]) {
        nodes[child.roomId] = {
          room_id: child.roomId,
          name: null,
          canonical_alias: null,
          room_type: null,
          joined_members: null,
          children: [],
          unresolved: true,
        };
      }
    }
  }

  return { topLevelIds, nodes };
}

function auth(config) {
  return (req, res, next) => {
    const accessToken = req.cookies?.[TOKEN_COOKIE];
    if (!accessToken) {
      return res.status(401).json({ error: 'Not signed in.' });
    }
    req.matrixClient = new MatrixClient({
      homeserverUrl: config.homeserverUrl,
      serverName: config.serverName,
      accessToken,
    });
    next();
  };
}

export function createServer(config) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(publicDir));

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required.' });
    }

    const client = new MatrixClient({
      homeserverUrl: config.homeserverUrl,
      serverName: config.serverName,
      adminUser: username,
      adminPassword: password,
    });

    try {
      const accessToken = await client.login();
      const me = await client.whoami();
      res.cookie(TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
      res.cookie(USER_COOKIE, me.user_id, COOKIE_OPTIONS);
      res.json({ userId: me.user_id });
    } catch (err) {
      res.status(401).json({ error: errorMessage(err) });
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie(TOKEN_COOKIE);
    res.clearCookie(USER_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/me', auth(config), async (req, res) => {
    try {
      const me = await req.matrixClient.whoami();
      res.json({ userId: me.user_id });
    } catch {
      res.status(401).json({ error: 'Invalid session.' });
    }
  });

  app.get('/api/tree', auth(config), async (req, res) => {
    try {
      const hierarchy = await req.matrixClient.getSpaceHierarchy();
      res.json(serializeHierarchy(hierarchy));
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.get('/api/rooms/:roomId/members', auth(config), async (req, res) => {
    try {
      const groups = await req.matrixClient.getMembersByPowerLevel(req.params.roomId);
      res.json({ groups });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.post('/api/rooms', auth(config), async (req, res) => {
    const { name, isSpace, topic, parentId } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name is required.' });
    }
    try {
      const roomId = await req.matrixClient.createRoom({
        name,
        isSpace: Boolean(isSpace),
        topic: topic || undefined,
        parentId: parentId || null,
      });
      res.json({ roomId });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.post('/api/rooms/:roomId/move', auth(config), async (req, res) => {
    const { toSpaceId, fromSpaceId } = req.body || {};
    try {
      const result = await req.matrixClient.moveNode(req.params.roomId, {
        toSpaceId: toSpaceId || null,
        fromSpaceId: fromSpaceId || null,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.delete('/api/rooms/:roomId', auth(config), async (req, res) => {
    try {
      await req.matrixClient.deleteRoom(req.params.roomId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  return app;
}
