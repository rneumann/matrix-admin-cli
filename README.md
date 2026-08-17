# matrix-admin-cli

CLI-Tools zum Testen des Benutzer-Provisionings auf einem Matrix-Server (z.B. Synapse Admin API).

CLI-Struktur, Konfiguration und Anbindung an die Matrix Client-Server API / Synapse Admin API
(getestet gegen https://matrix.h-ka.de).

Der `MATRIX_ADMIN_TOKEN` muss ein Access-Token eines Accounts mit Server-Admin-Rechten sein
(`admin: true` in der Synapse-Datenbank/Admin-API). Ohne Admin-Rechte schlagen `user create`,
`user list` und `user deactivate` mit HTTP 403 fehl.

**Berechtigungen** gibt es auf zwei Ebenen: der globale Server-Admin-Flag (`user info` /
`user create --admin`) und der raumspezifische Power-Level aus dem `m.room.power_levels`
State-Event (`room power-levels`). Letzterer ist aktuell nur lesbar, das Setzen folgt spaeter.

**Passwoerter** koennen nicht als Hash abgefragt werden - Synapse gibt sie nie ueber die API
heraus. `user check-password` prueft daher per echtem Login-Versuch ("bind"-Pattern) und loggt
die dabei erzeugte Session sofort wieder aus.

## Setup

```bash
npm install
cp .env.example .env
# .env mit Homeserver-URL, Admin-Token und Server-Name ausfuellen
```

## Nutzung

```bash
node bin/matrix-admin.js whoami
node bin/matrix-admin.js user create testuser --password geheim123
node bin/matrix-admin.js user list
node bin/matrix-admin.js user deactivate @testuser:example.org

node bin/matrix-admin.js user info womi0003
node bin/matrix-admin.js user info womi0003 --json

node bin/matrix-admin.js room list
node bin/matrix-admin.js space list
node bin/matrix-admin.js space members '!roomid:example.org'
node bin/matrix-admin.js space is-member '!roomid:example.org' @testuser:example.org

node bin/matrix-admin.js room power-levels '!roomid:example.org'
node bin/matrix-admin.js room power-levels '!roomid:example.org' --user @testuser:example.org

# Passwort validieren (echter Login-Versuch, Session wird sofort ausgeloggt).
# Ohne --password wird interaktiv (maskiert) danach gefragt.
node bin/matrix-admin.js user check-password testuser
```

Alternativ nach `npm link`:

```bash
matrix-admin whoami
```

## Struktur

```
bin/matrix-admin.js     CLI-Einstiegspunkt
src/cli.js               Command-Definitionen (commander)
src/config.js             Laedt/validiert .env-Konfiguration
src/matrixClient.js       Client-Stub fuer die Matrix Admin API
src/commands/             Ein Modul pro Subcommand
```
