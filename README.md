# matrix-admin-cli

CLI tools for testing user provisioning on a Matrix server (e.g. Synapse Admin API).

CLI structure, configuration, and integration with the Matrix Client-Server API / Synapse Admin
API. Tested against Synapse-compatible homeservers - some homeservers (e.g. Conduit/Conduwuit)
run something other than Synapse but still expose a compatible Synapse Admin API.

`MATRIX_ADMIN_USER` / `MATRIX_ADMIN_PASSWORD` must be the credentials of an account with server
admin rights (`admin: true` in the Synapse database/Admin API). The CLI logs in with these on the
first request via `POST /_matrix/client/v3/login` and caches the resulting access token for the
duration of the call. Without admin rights, `user create`, `user list` and `user deactivate` fail
with HTTP 403.

**Permissions** exist on two levels: the global server admin flag (`user info` /
`user create --admin`) and the room-specific power level from the `m.room.power_levels` state
event (`room power-levels`). The latter is currently read-only; setting it is planned for later.

**Passwords** cannot be queried as a hash - Synapse never exposes them via the API.
`user check-password` therefore verifies via a real login attempt ("bind" pattern) and immediately
logs out the session created for it.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env with homeserver URL, admin credentials and server name
```

## Usage

```bash
node bin/matrix-admin.js whoami
node bin/matrix-admin.js user create testuser --password secret123
node bin/matrix-admin.js user list
node bin/matrix-admin.js user deactivate @testuser:example.org

node bin/matrix-admin.js user info testuser
node bin/matrix-admin.js user info testuser --json

node bin/matrix-admin.js room list
node bin/matrix-admin.js space list
node bin/matrix-admin.js space members '!roomid:example.org'
node bin/matrix-admin.js space is-member '!roomid:example.org' @testuser:example.org

node bin/matrix-admin.js room power-levels '!roomid:example.org'
node bin/matrix-admin.js room power-levels '!roomid:example.org' --user @testuser:example.org

# Hierarchical listing of all spaces/rooms (nesting via m.space.child)
node bin/matrix-admin.js space tree
node bin/matrix-admin.js space tree --root 'ParentSpace'

# Move a room/space into another space, or to the top level.
# Without --from it is removed from ALL parent spaces currently found; with --from
# only from the given one. Requires sufficient power (state_default) in the
# affected space(s).
node bin/matrix-admin.js move 'SubRoom' --to 'TargetSpace'
node bin/matrix-admin.js move 'SubRoom' --top-level
node bin/matrix-admin.js move 'SubRoom' --from 'OldSpace' --to 'TargetSpace'

# Permanently delete a room/space from the server (purge, including all messages).
# Best-effort removes the m.space.child references from all parent spaces first.
node bin/matrix-admin.js delete 'SubRoom' --yes

# Set a power level via the server admin bot ("!admin users force-promote").
# Requires the target user to already be a member of the room - does NOT cause a join itself.
node bin/matrix-admin.js room promote 'General'
node bin/matrix-admin.js room promote 'General' --user @testuser:example.org

# Validate a password (real login attempt, session is logged out immediately).
# Without --password you are prompted interactively (masked input).
node bin/matrix-admin.js user check-password testuser

# Have the current admin user (from MATRIX_ADMIN_USER) join a single room/space.
# roomId accepts a room ID (!...), alias (#...), or the display name as shown by
# "room list"/"space list".
# Only works for public rooms: the admin join endpoint (and the
# "!admin users force-join-room"/"force-promote" bot commands) reject restricted and private
# rooms with the same auth check as a regular join. For such rooms only a regular invite from
# an existing member helps.
node bin/matrix-admin.js join '!roomid:example.org'
node bin/matrix-admin.js join 'General'
node bin/matrix-admin.js join 'General' --user @testuser:example.org

# Have the current admin user (from MATRIX_ADMIN_USER) join all rooms and spaces
node bin/matrix-admin.js join-all --dry-run
node bin/matrix-admin.js join-all
```

Alternatively, after `npm link`:

```bash
matrix-admin whoami
```

## Web UI

Lightweight interactive web UI (Express server + vanilla-JS frontend, no build step/framework)
for the tree view, member overview, and creating/moving/deleting rooms and spaces (deleting
requires confirmation in a dialog, since it is irreversible):

```bash
npm run web
# or: node bin/matrix-admin.js serve --port 3000
```

Then open `http://localhost:3000`. Unlike the CLI commands, the web UI does **not** use a fixed
admin account from `.env` - each person signs in in the browser with their own Matrix credentials
(a real `POST /_matrix/client/v3/login`, the access token ends up in an httpOnly cookie, no
server-side session store). The web UI therefore only needs `MATRIX_HOMESERVER_URL` and
`MATRIX_SERVER_NAME` in `.env`; the remaining features (reading the tree, creating/moving
rooms/spaces) require the logged-in account to have sufficient rights server-side (server admin
for the tree view via the Synapse Admin API, `state_default` power in the respective space for
creating/moving).

User-specific features (e.g. provisioning individual users via the web UI) are deliberately not
included yet and will follow in a later step.

## Structure

```
bin/matrix-admin.js     CLI entry point
src/cli.js               Command definitions (commander)
src/config.js             Loads/validates .env configuration
src/matrixClient.js       Client wrapper for the Matrix Admin API
src/commands/             One module per subcommand
src/web/server.js         Express backend for the web UI (login cookie, JSON API)
public/                   Static web UI frontend (HTML/CSS/vanilla JS, no build step)
```

## License

MIT, see [LICENSE](LICENSE). Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe.
