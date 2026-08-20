// Client fuer die Matrix Client-Server API und die Synapse Admin API.
// Referenzen:
//  - Client-Server API: https://spec.matrix.org/latest/client-server-api/
//  - Synapse Admin API: https://element-hq.github.io/synapse/latest/usage/administration/admin_api/

export class MatrixClient {
  constructor({ homeserverUrl, adminUser, adminPassword, serverName }) {
    this.homeserverUrl = homeserverUrl;
    this.adminUser = adminUser;
    this.adminPassword = adminPassword;
    this.serverName = serverName;
    this.accessToken = null;
  }

  /**
   * Loggt sich mit Benutzername/Passwort ein und cached den Access-Token
   * fuer nachfolgende Requests dieser Client-Instanz.
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
   * Wie listRooms(), blaettert aber ueber next_batch bis zum Ende durch und
   * liefert alle Raeume (optional gefiltert ueber room_types) als flache Liste.
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
   * Sendet eine Textnachricht in einen Raum (regulaerer Client-Endpoint,
   * kein Admin-API-Aufruf).
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
   * Setzt den Power-Level eines Benutzers in einem Raum ueber den
   * "!admin users force-promote"-Befehl im Server-Admin-Room. Erfordert, dass
   * der Benutzer bereits Mitglied des Raums ist und dort schon ein
   * privilegierter (Ex-)Nutzer existiert, von dem delegiert werden kann -
   * bewirkt selbst KEINEN Join, nur eine Power-Level-Aenderung.
   */
  async forcePromoteIntoRoom(userId, roomIdOrAlias, adminRoomId) {
    await this.sendRoomMessage(adminRoomId, `!admin users force-promote ${userId} ${roomIdOrAlias}`);
  }

  /**
   * Laedt einen Benutzer regulaer in einen Raum ein (Client-Server API,
   * kein Admin-API-Aufruf). Erfordert, dass dieser Client bereits Mitglied
   * mit ausreichend Power (invite-Schwelle) im Raum ist.
   * POST /_matrix/client/v3/rooms/<room_id>/invite
   */
  async inviteToRoom(roomId, userId) {
    return this.request('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
      body: { user_id: userId },
    });
  }

  /**
   * Regulaerer (nicht-Admin-API) Join mit dem eigenen Access-Token dieses
   * Clients. Funktioniert fuer einen eingeladenen Benutzer immer, auch bei
   * restricted/privaten Raeumen (Invites umgehen die join_rules-Pruefung).
   * POST /_matrix/client/v3/join/<room_id_or_alias>
   */
  async selfJoinRoom(roomIdOrAlias) {
    return this.request('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`, { body: {} });
  }

  /**
   * Setzt den Power-Level eines Benutzers in einem Raum direkt ueber die
   * Standard-Client-API. Kein Admin-Bot noetig, sofern dieser Client bereits
   * ausreichend Power im Raum hat, um m.room.power_levels zu editieren.
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
   * Loest einen Raum-Identifier auf: Room-IDs (!...) und Aliase (#...) werden
   * unveraendert durchgereicht, alles andere wird als Raumname interpretiert
   * und gegen die Raumliste des Servers aufgeloest (exakte Treffer bevorzugt,
   * sonst alle Substring-Treffer von search_term).
   */
  async resolveRoomId(identifier) {
    if (identifier.startsWith('!') || identifier.startsWith('#')) {
      return identifier;
    }

    const rooms = await this.listAllRooms({ search_term: identifier });
    const exact = rooms.filter((r) => r.name?.toLowerCase() === identifier.toLowerCase());
    const candidates = exact.length > 0 ? exact : rooms;

    if (candidates.length === 0) {
      throw new Error(`Kein Raum/Space mit Namen "${identifier}" gefunden.`);
    }
    if (candidates.length > 1) {
      const names = candidates
        .map((r) => `${r.name || r.canonical_alias || r.room_id} (${r.room_id})`)
        .join(', ');
      throw new Error(`Mehrdeutiger Raumname "${identifier}": ${names}`);
    }

    return candidates[0].room_id;
  }

  /**
   * Laesst einen Benutzer per Admin-API einem Raum beitreten, ohne dass der
   * Benutzer selbst aktiv werden muss (z.B. fuer Server-Admins ohne Einladung).
   * POST /_synapse/admin/v1/join/<room_id_or_alias>
   */
  async joinRoom(roomIdOrAlias, userId) {
    return this.request('POST', `/_synapse/admin/v1/join/${encodeURIComponent(roomIdOrAlias)}`, {
      body: { user_id: userId },
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
