// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

// Client for the Matrix Client-Server API and the Synapse Admin API.
// References:
//  - Client-Server API: https://spec.matrix.org/latest/client-server-api/
//  - Synapse Admin API: https://element-hq.github.io/synapse/latest/usage/administration/admin_api/

/**
 * Applies fn to every element of items, with at most `limit` calls running
 * concurrently. The Matrix API has no endpoint that returns e.g. "all
 * top-level spaces" in a single request - each space has to be checked
 * individually for its child relationships. Without parallelization this
 * adds up to one round trip of latency per space.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const SPACE_SCAN_CONCURRENCY = 8;

export class MatrixClient {
  constructor({ homeserverUrl, adminUser, adminPassword, serverName, accessToken }) {
    this.homeserverUrl = homeserverUrl;
    this.adminUser = adminUser;
    this.adminPassword = adminPassword;
    this.serverName = serverName;
    this.accessToken = accessToken ?? null;
  }

  /**
   * Logs in with username/password and caches the access token for
   * subsequent requests made by this client instance.
   * POST /_matrix/client/v3/login
   */
  async login() {
    if (this.accessToken) return this.accessToken;

    const localpart = this.adminUser.startsWith('@')
      ? this.adminUser.slice(1).split(':')[0]
      : this.adminUser;

    const session = await this.request('POST', '/_matrix/client/v3/login', {
      body: {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: localpart },
        password: this.adminPassword,
        initial_device_display_name: 'matrix-admin-cli',
      },
      skipAuth: true,
    });

    this.accessToken = session.access_token;
    return this.accessToken;
  }

  async request(method, path, { body, query, token, skipAuth = false } = {}) {
    if (!skipAuth && !token) {
      await this.login();
    }

    const url = new URL(this.homeserverUrl + path);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(key, v);
        } else {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers = { 'Content-Type': 'application/json' };
    const authToken = token ?? this.accessToken;
    if (!skipAuth && authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const message = data.error || data.errcode || res.statusText;
      const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${message}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  /**
   * Verifies the admin token and returns the associated user ID.
   * GET /_matrix/client/v3/account/whoami
   */
  async whoami() {
    return this.request('GET', '/_matrix/client/v3/account/whoami');
  }

  /**
   * List of users on the server.
   * GET /_synapse/admin/v2/users
   */
  async listUsers({ limit = 50, from, name, guests, deactivated } = {}) {
    return this.request('GET', '/_synapse/admin/v2/users', {
      query: { limit, from, name, guests, deactivated },
    });
  }

  /**
   * Details of a single user.
   * GET /_synapse/admin/v2/users/<user_id>
   */
  async getUser(userId) {
    return this.request('GET', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Rooms (including spaces) a user has joined.
   * GET /_synapse/admin/v1/users/<user_id>/joined_rooms
   */
  async getJoinedRooms(userId) {
    return this.request('GET', `/_synapse/admin/v1/users/${encodeURIComponent(userId)}/joined_rooms`);
  }

  /**
   * Creates a new user or updates an existing one.
   * PUT /_synapse/admin/v2/users/<user_id>
   */
  async createUser(userId, { password, admin = false, displayname } = {}) {
    const body = { admin };
    if (password) body.password = password;
    if (displayname) body.displayname = displayname;

    return this.request('PUT', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, { body });
  }

  /**
   * Deactivates a user (login/sessions get invalidated).
   * POST /_synapse/admin/v1/deactivate/<user_id>
   */
  async deactivateUser(userId, { erase = false } = {}) {
    return this.request('POST', `/_synapse/admin/v1/deactivate/${encodeURIComponent(userId)}`, {
      body: { erase },
    });
  }

  /**
   * List of rooms on the server. Can be filtered to spaces via room_types
   * (e.g. "m.space").
   * GET /_synapse/admin/v1/rooms
   */
  async listRooms({ limit = 50, from, search_term, order_by, dir, room_types } = {}) {
    return this.request('GET', '/_synapse/admin/v1/rooms', {
      query: { limit, from, search_term, order_by, dir, room_types },
    });
  }

  /**
   * Like listRooms(), but pages through next_batch until the end and
   * returns all rooms (optionally filtered via room_types) as a flat list.
   */
  async listAllRooms({ search_term, order_by, dir, room_types } = {}) {
    const rooms = [];
    let from;

    do {
      const page = await this.listRooms({ limit: 100, from, search_term, order_by, dir, room_types });
      rooms.push(...(page.rooms ?? []));
      from = page.next_batch;
    } while (from);

    return rooms;
  }

  /**
   * Sends a text message into a room (regular client endpoint, not an
   * admin API call).
   * PUT /_matrix/client/v3/rooms/<room_id>/send/m.room.message/<txnId>
   */
  async sendRoomMessage(roomId, body) {
    const txnId = `m${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return this.request(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
      { body: { msgtype: 'm.text', body } }
    );
  }

  /**
   * Sets a user's power level in a room via the "!admin users
   * force-promote" command in the server admin room. Requires that the
   * user is already a member of the room and that a privileged (former)
   * user already exists there to delegate from - does NOT cause a join
   * itself, only a power level change.
   */
  async forcePromoteIntoRoom(userId, roomIdOrAlias, adminRoomId) {
    await this.sendRoomMessage(adminRoomId, `!admin users force-promote ${userId} ${roomIdOrAlias}`);
  }

  /**
   * Regularly invites a user into a room (Client-Server API, not an admin
   * API call). Requires that this client is already a member with
   * sufficient power (invite threshold) in the room.
   * POST /_matrix/client/v3/rooms/<room_id>/invite
   */
  async inviteToRoom(roomId, userId) {
    return this.request('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
      body: { user_id: userId },
    });
  }

  /**
   * Regular (non-admin-API) join using this client's own access token.
   * Always works for an invited user, even for restricted/private rooms
   * (invites bypass the join_rules check).
   * POST /_matrix/client/v3/join/<room_id_or_alias>
   */
  async selfJoinRoom(roomIdOrAlias) {
    return this.request('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`, { body: {} });
  }

  /**
   * Sets a user's power level in a room directly via the standard client
   * API. No admin bot needed, as long as this client already has
   * sufficient power in the room to edit m.room.power_levels.
   */
  async setUserPowerLevel(roomId, userId, level) {
    const current = await this.request(
      'GET',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`
    );
    const updated = { ...current, users: { ...(current.users ?? {}), [userId]: level } };
    return this.request('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`, {
      body: updated,
    });
  }

  /**
   * Resolves a room identifier: room IDs (!...) and aliases (#...) are
   * passed through unchanged, anything else is treated as a room name and
   * resolved against the server's room list (exact matches preferred,
   * otherwise all substring matches of search_term).
   */
  async resolveRoomId(identifier) {
    if (identifier.startsWith('!') || identifier.startsWith('#')) {
      return identifier;
    }

    const rooms = await this.listAllRooms({ search_term: identifier });
    const exact = rooms.filter((r) => r.name?.toLowerCase() === identifier.toLowerCase());
    const candidates = exact.length > 0 ? exact : rooms;

    if (candidates.length === 0) {
      throw new Error(`No room/space named "${identifier}" found.`);
    }
    if (candidates.length > 1) {
      const names = candidates
        .map((r) => `${r.name || r.canonical_alias || r.room_id} (${r.room_id})`)
        .join(', ');
      throw new Error(`Ambiguous room name "${identifier}": ${names}`);
    }

    return candidates[0].room_id;
  }

  /**
   * Lets a user join a room via the admin API, without requiring the user
   * to act themselves (e.g. for server admins without an invite).
   * POST /_synapse/admin/v1/join/<room_id_or_alias>
   */
  async joinRoom(roomIdOrAlias, userId) {
    return this.request('POST', `/_synapse/admin/v1/join/${encodeURIComponent(roomIdOrAlias)}`, {
      body: { user_id: userId },
    });
  }

  /**
   * List of spaces on the server (rooms with room_type "m.space").
   * GET /_synapse/admin/v1/rooms?room_types=m.space
   */
  async listSpaces({ limit = 50, from, search_term, order_by, dir } = {}) {
    return this.listRooms({ limit, from, search_term, order_by, dir, room_types: ['m.space'] });
  }

  /**
   * Reads a single state event (regular Client-Server API).
   * GET /_matrix/client/v3/rooms/<room_id>/state/<eventType>/<stateKey>
   */
  async getStateEvent(roomId, eventType, stateKey = '') {
    return this.request(
      'GET',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${eventType}/${encodeURIComponent(stateKey)}`
    );
  }

  /**
   * Sets a state event (regular Client-Server API). Requires that this
   * client already has sufficient power (state_default) in the room.
   * PUT /_matrix/client/v3/rooms/<room_id>/state/<eventType>/<stateKey>
   */
  async setStateEvent(roomId, eventType, stateKey, content) {
    return this.request(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${eventType}/${encodeURIComponent(stateKey)}`,
      { body: content }
    );
  }

  /**
   * Reads all m.space.child events of a space (its child rooms/spaces).
   * Events with empty content count as removed per spec and are filtered
   * out.
   */
  async getSpaceChildren(spaceId) {
    const { state = [] } = await this.getRoomState(spaceId);
    return state
      .filter((e) => e.type === 'm.space.child' && e.content && Object.keys(e.content).length > 0)
      .map((e) => ({ roomId: e.state_key, ...e.content }));
  }

  /**
   * Places a room/space as a child inside a space by setting an
   * m.space.child event in the space. Requires sufficient power in the
   * target space.
   */
  async addSpaceChild(spaceId, childRoomId, { suggested = false, order } = {}) {
    const content = { via: [this.serverName], suggested };
    if (order) content.order = order;
    return this.setStateEvent(spaceId, 'm.space.child', childRoomId, content);
  }

  /**
   * Removes a room/space from a space again (empty content on the
   * m.space.child event). Requires sufficient power in the space.
   */
  async removeSpaceChild(spaceId, childRoomId) {
    return this.setStateEvent(spaceId, 'm.space.child', childRoomId, {});
  }

  /**
   * Optionally sets the reciprocal m.space.parent event on the child room
   * itself. Purely informational for clients, not a prerequisite for the
   * space structure (which is defined exclusively via m.space.child in
   * the space).
   */
  async setSpaceParent(childRoomId, spaceId, { canonical = true } = {}) {
    return this.setStateEvent(childRoomId, 'm.space.parent', spaceId, { via: [this.serverName], canonical });
  }

  /**
   * Removes the reciprocal m.space.parent event from the child room again.
   */
  async removeSpaceParent(childRoomId, spaceId) {
    return this.setStateEvent(childRoomId, 'm.space.parent', spaceId, {});
  }

  /**
   * Finds all spaces on the server that currently list roomId as a child
   * (via m.space.child, not via the potentially unreliable m.space.parent
   * on the child itself).
   */
  async findParentSpaces(roomId) {
    const spaces = await this.listAllRooms({ room_types: ['m.space'] });

    const hits = await mapWithConcurrency(spaces, SPACE_SCAN_CONCURRENCY, async (space) => {
      const children = await this.getSpaceChildren(space.room_id);
      return children.some((c) => c.roomId === roomId) ? space : null;
    });

    return hits.filter(Boolean);
  }

  /**
   * Checks whether targetId is (directly or transitively) a child of
   * roomId - used to prevent cycles in the space hierarchy when moving.
   */
  async isDescendant(roomId, targetId, seen = new Set()) {
    if (roomId === targetId) return true;
    if (seen.has(roomId)) return false;
    seen.add(roomId);

    const children = await this.getSpaceChildren(roomId).catch(() => []);
    for (const child of children) {
      if (await this.isDescendant(child.roomId, targetId, seen)) return true;
    }
    return false;
  }

  /**
   * Builds the server's complete space hierarchy: all rooms/spaces, plus
   * each space's children (from m.space.child). Basis for a hierarchical
   * tree view.
   */
  async getSpaceHierarchy() {
    const rooms = await this.listAllRooms({});
    const byId = new Map(rooms.map((r) => [r.room_id, r]));
    const spaces = rooms.filter((r) => r.room_type === 'm.space');

    const childrenMap = new Map();
    const parentIds = new Set();

    await mapWithConcurrency(spaces, SPACE_SCAN_CONCURRENCY, async (space) => {
      const children = await this.getSpaceChildren(space.room_id);
      childrenMap.set(space.room_id, children);
      for (const child of children) parentIds.add(child.roomId);
    });

    const topLevelIds = rooms.map((r) => r.room_id).filter((id) => !parentIds.has(id));

    return { rooms, byId, childrenMap, topLevelIds };
  }

  /**
   * Creates a new room or space (regular Client-Server API, this client
   * automatically becomes a member). If parentId is set, the new
   * room/space is then placed into that space via addSpaceChild() (incl.
   * a best-effort attempt at the reciprocal m.space.parent).
   * POST /_matrix/client/v3/createRoom
   */
  async createRoom({ name, isSpace = false, topic, parentId, visibility = 'public' } = {}) {
    const body = {
      name,
      visibility,
      preset: visibility === 'public' ? 'public_chat' : 'private_chat',
    };
    if (topic) body.topic = topic;
    if (isSpace) body.creation_content = { type: 'm.space' };

    const { room_id: roomId } = await this.request('POST', '/_matrix/client/v3/createRoom', { body });

    if (parentId) {
      await this.addSpaceChild(parentId, roomId);
      try {
        await this.setSpaceParent(roomId, parentId);
      } catch {
        // m.space.parent on the child is informational only, errors here are non-critical
      }
    }

    return roomId;
  }

  /**
   * Members of a room/space, grouped by effective power level (explicit
   * entry in m.room.power_levels.users, otherwise users_default). Returns
   * a list sorted by level, descending.
   */
  async getMembersByPowerLevel(roomId) {
    const [{ members = [] }, levels] = await Promise.all([
      this.getRoomMembers(roomId),
      this.getRoomPowerLevels(roomId),
    ]);

    const usersDefault = levels.users_default ?? 0;
    const explicit = levels.users ?? {};
    const groups = new Map();

    for (const userId of members) {
      const level = explicit[userId] ?? usersDefault;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push(userId);
    }

    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([level, userIds]) => ({ level, userIds: userIds.sort() }));
  }

  /**
   * Moves a room/space within the space hierarchy: removes it from its
   * current parent space(s) (or only from fromSpaceId, if given) and
   * optionally places it into toSpaceId. toSpaceId === null means
   * top-level (no parent space anymore). roomId/toSpaceId/fromSpaceId
   * must already be resolved room IDs.
   */
  async moveNode(roomId, { toSpaceId = null, fromSpaceId = null } = {}) {
    if (toSpaceId) {
      if (toSpaceId === roomId) {
        throw new Error('A room/space cannot be moved into itself.');
      }
      if (await this.isDescendant(roomId, toSpaceId)) {
        throw new Error(
          `${toSpaceId} is (directly or transitively) already a child of ${roomId} - moving it ` +
            'would create a cycle in the space hierarchy.'
        );
      }
    }

    const parents = fromSpaceId ? [{ room_id: fromSpaceId }] : await this.findParentSpaces(roomId);
    const removedFrom = [];

    for (const parent of parents) {
      if (toSpaceId && parent.room_id === toSpaceId) continue;

      await this.removeSpaceChild(parent.room_id, roomId);
      try {
        await this.removeSpaceParent(roomId, parent.room_id);
      } catch {
        // m.space.parent on the child is informational only, errors here are non-critical
      }
      removedFrom.push(parent.room_id);
    }

    if (toSpaceId) {
      await this.addSpaceChild(toSpaceId, roomId);
      try {
        await this.setSpaceParent(roomId, toSpaceId);
      } catch {
        // m.space.parent on the child is informational only, errors here are non-critical
      }
    }

    return { removedFrom, addedTo: toSpaceId };
  }

  /**
   * Permanently deletes a room/space from the server (Synapse Admin API,
   * purge=true by default). First removes, best-effort, the
   * m.space.child references from all current parent spaces so no dead
   * references are left behind - a failure there does not block the
   * actual deletion.
   * DELETE /_synapse/admin/v1/rooms/<room_id>
   */
  async deleteRoom(roomId, { purge = true, block = false } = {}) {
    const parents = await this.findParentSpaces(roomId).catch(() => []);
    for (const parent of parents) {
      await this.removeSpaceChild(parent.room_id, roomId).catch(() => {});
    }

    return this.request('DELETE', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`, {
      body: { purge, block },
    });
  }

  /**
   * Members of a room or space.
   * GET /_synapse/admin/v1/rooms/<room_id>/members
   */
  async getRoomMembers(roomId) {
    return this.request('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`);
  }

  /**
   * Checks whether a user is a member of a room/space.
   * Based on GET /_synapse/admin/v1/rooms/<room_id>/members
   */
  async isRoomMember(roomId, userId) {
    const { members = [] } = await this.getRoomMembers(roomId);
    return members.includes(userId);
  }

  /**
   * Full state of a room (including the m.room.power_levels event).
   * GET /_synapse/admin/v1/rooms/<room_id>/state
   */
  async getRoomState(roomId) {
    return this.request('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/state`);
  }

  /**
   * Content of a room's m.room.power_levels state event (users,
   * users_default, kick/ban/invite/redact thresholds, ...).
   */
  async getRoomPowerLevels(roomId) {
    const { state = [] } = await this.getRoomState(roomId);
    const event = state.find((e) => e.type === 'm.room.power_levels');
    return event?.content ?? {};
  }

  /**
   * A user's effective power level in a room: explicit entry in "users",
   * otherwise the room default "users_default" (default 0).
   */
  async getUserPowerLevel(roomId, userId) {
    const levels = await this.getRoomPowerLevels(roomId);
    return levels.users?.[userId] ?? levels.users_default ?? 0;
  }

  /**
   * Verifies a password via a real login attempt ("bind" pattern) and
   * immediately logs out the session created for it. The server never
   * hands out password hashes via the API - a real login is the only way
   * to verify a password.
   * POST /_matrix/client/v3/login + POST /_matrix/client/v3/logout
   */
  async checkPassword(userId, password) {
    const localpart = userId.startsWith('@') ? userId.slice(1).split(':')[0] : userId;

    let session;
    try {
      session = await this.request('POST', '/_matrix/client/v3/login', {
        body: {
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: localpart },
          password,
          initial_device_display_name: 'matrix-admin-cli password-check',
        },
      });
    } catch (err) {
      if (err.status === 403 || err.status === 401) {
        return { valid: false, reason: err.data?.error ?? 'Invalid password' };
      }
      throw err;
    }

    await this.request('POST', '/_matrix/client/v3/logout', { token: session.access_token });
    return { valid: true };
  }
}
