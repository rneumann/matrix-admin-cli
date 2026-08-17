// Client fuer die Matrix Client-Server API und die Synapse Admin API.
// Referenzen:
//  - Client-Server API: https://spec.matrix.org/latest/client-server-api/
//  - Synapse Admin API: https://element-hq.github.io/synapse/latest/usage/administration/admin_api/

export class MatrixClient {
  constructor({ homeserverUrl, adminToken, serverName }) {
    this.homeserverUrl = homeserverUrl;
    this.adminToken = adminToken;
    this.serverName = serverName;
  }

  async request(method, path, { body, query, token } = {}) {
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

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token ?? this.adminToken}`,
        'Content-Type': 'application/json',
      },
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
   * Prueft den Admin-Token und liefert die zugehoerige User-ID.
   * GET /_matrix/client/v3/account/whoami
   */
  async whoami() {
    return this.request('GET', '/_matrix/client/v3/account/whoami');
  }

  /**
   * Liste der Benutzer auf dem Server.
   * GET /_synapse/admin/v2/users
   */
  async listUsers({ limit = 50, from, name, guests, deactivated } = {}) {
    return this.request('GET', '/_synapse/admin/v2/users', {
      query: { limit, from, name, guests, deactivated },
    });
  }

  /**
   * Details zu einem einzelnen Benutzer.
   * GET /_synapse/admin/v2/users/<user_id>
   */
  async getUser(userId) {
    return this.request('GET', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Raeume (inkl. Spaces), denen ein Benutzer beigetreten ist.
   * GET /_synapse/admin/v1/users/<user_id>/joined_rooms
   */
  async getJoinedRooms(userId) {
    return this.request('GET', `/_synapse/admin/v1/users/${encodeURIComponent(userId)}/joined_rooms`);
  }

  /**
   * Legt einen neuen Benutzer an oder aktualisiert einen bestehenden.
   * PUT /_synapse/admin/v2/users/<user_id>
   */
  async createUser(userId, { password, admin = false, displayname } = {}) {
    const body = { admin };
    if (password) body.password = password;
    if (displayname) body.displayname = displayname;

    return this.request('PUT', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, { body });
  }

  /**
   * Deaktiviert einen Benutzer (Login/Sessions werden invalidiert).
   * POST /_synapse/admin/v1/deactivate/<user_id>
   */
  async deactivateUser(userId, { erase = false } = {}) {
    return this.request('POST', `/_synapse/admin/v1/deactivate/${encodeURIComponent(userId)}`, {
      body: { erase },
    });
  }

  /**
   * Liste der Raeume auf dem Server. Ueber room_types (z.B. "m.space")
   * laesst sich auf Spaces filtern.
   * GET /_synapse/admin/v1/rooms
   */
  async listRooms({ limit = 50, from, search_term, order_by, dir, room_types } = {}) {
    return this.request('GET', '/_synapse/admin/v1/rooms', {
      query: { limit, from, search_term, order_by, dir, room_types },
    });
  }

  /**
   * Liste der Spaces auf dem Server (Raeume mit room_type "m.space").
   * GET /_synapse/admin/v1/rooms?room_types=m.space
   */
  async listSpaces({ limit = 50, from, search_term, order_by, dir } = {}) {
    return this.listRooms({ limit, from, search_term, order_by, dir, room_types: ['m.space'] });
  }

  /**
   * Mitglieder eines Raums bzw. Space.
   * GET /_synapse/admin/v1/rooms/<room_id>/members
   */
  async getRoomMembers(roomId) {
    return this.request('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`);
  }

  /**
   * Prueft, ob ein Benutzer Mitglied eines Raums/Space ist.
   * Basiert auf GET /_synapse/admin/v1/rooms/<room_id>/members
   */
  async isRoomMember(roomId, userId) {
    const { members = [] } = await this.getRoomMembers(roomId);
    return members.includes(userId);
  }

  /**
   * Vollstaendiger State eines Raums (u.a. das m.room.power_levels Event).
   * GET /_synapse/admin/v1/rooms/<room_id>/state
   */
  async getRoomState(roomId) {
    return this.request('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/state`);
  }

  /**
   * Content des m.room.power_levels State-Events eines Raums
   * (users, users_default, kick/ban/invite/redact-Schwellwerte, ...).
   */
  async getRoomPowerLevels(roomId) {
    const { state = [] } = await this.getRoomState(roomId);
    const event = state.find((e) => e.type === 'm.room.power_levels');
    return event?.content ?? {};
  }

  /**
   * Effektiver Power-Level eines Users in einem Raum: expliziter Eintrag in
   * "users", sonst der Raum-Default "users_default" (Standard 0).
   */
  async getUserPowerLevel(roomId, userId) {
    const levels = await this.getRoomPowerLevels(roomId);
    return levels.users?.[userId] ?? levels.users_default ?? 0;
  }

  /**
   * Prueft ein Passwort per echtem Login-Versuch ("bind"-Pattern) und loggt
   * die dabei erzeugte Session sofort wieder aus. Der Server gibt Passwort-
   * Hashes grundsaetzlich nicht ueber die API heraus - ein echter Login ist
   * der einzige Weg, ein Passwort zu verifizieren.
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
