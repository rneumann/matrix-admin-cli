# matrix-admin-cli

CLI-Tools zum Testen des Benutzer-Provisionings auf einem Matrix-Server (z.B. Synapse Admin API).

CLI-Struktur, Konfiguration und Anbindung an die Matrix Client-Server API / Synapse Admin API
(getestet gegen https://matrix.h-ka.de, laeuft dort auf Conduit/Conduwuit statt Synapse - die
Synapse Admin API wird aber kompatibel angeboten).

`MATRIX_ADMIN_USER` / `MATRIX_ADMIN_PASSWORD` muessen die Zugangsdaten eines Accounts mit
Server-Admin-Rechten sein (`admin: true` in der Synapse-Datenbank/Admin-API). Die CLI loggt sich
damit beim ersten Request per `POST /_matrix/client/v3/login` ein und cached den erhaltenen
Access-Token fuer die Dauer des Aufrufs. Ohne Admin-Rechte schlagen `user create`, `user list`
und `user deactivate` mit HTTP 403 fehl.

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
# .env mit Homeserver-URL, Admin-Zugangsdaten und Server-Name ausfuellen
```

## Nutzung

```bash
node bin/matrix-admin.js whoami
node bin/matrix-admin.js user create testuser --password geheim123
node bin/matrix-admin.js user list
node bin/matrix-admin.js user deactivate @testuser:example.org

node bin/matrix-admin.js user info nera0001
node bin/matrix-admin.js user info nera0001 --json

node bin/matrix-admin.js room list
node bin/matrix-admin.js space list
node bin/matrix-admin.js space members '!roomid:example.org'
node bin/matrix-admin.js space is-member '!roomid:example.org' @testuser:example.org

node bin/matrix-admin.js room power-levels '!roomid:example.org'
node bin/matrix-admin.js room power-levels '!roomid:example.org' --user @testuser:example.org

# Hierarchische Ausgabe aller Spaces/Raeume (Verschachtelung ueber m.space.child)
node bin/matrix-admin.js space tree
node bin/matrix-admin.js space tree --root 'Elternspace'

# Raum/Space in einen anderen Space verschieben, bzw. auf Toplevel-Ebene setzen.
# Ohne --from wird aus ALLEN aktuell gefundenen Eltern-Spaces entfernt; mit --from
# nur aus dem angegebenen. Erfordert ausreichend Power (state_default) im/in den
# betroffenen Space(s).
node bin/matrix-admin.js move 'Unterraum' --to 'Zielspace'
node bin/matrix-admin.js move 'Unterraum' --top-level
node bin/matrix-admin.js move 'Unterraum' --from 'AlterSpace' --to 'Zielspace'

# Raum/Space unwiderruflich vom Server loeschen (purge, inkl. aller Nachrichten).
# Entfernt vorher best-effort die m.space.child-Verweise aus allen Eltern-Spaces.
node bin/matrix-admin.js delete 'Unterraum' --yes

# Power-Level ueber den Server-Admin-Bot setzen ("!admin users force-promote").
# Erfordert, dass der Zielbenutzer bereits Mitglied des Raums ist - bewirkt selbst KEINEN Join.
node bin/matrix-admin.js room promote 'Allgemein'
node bin/matrix-admin.js room promote 'Allgemein' --user @testuser:example.org

# Passwort validieren (echter Login-Versuch, Session wird sofort ausgeloggt).
# Ohne --password wird interaktiv (maskiert) danach gefragt.
node bin/matrix-admin.js user check-password testuser

# Aktuellen Admin-User (aus MATRIX_ADMIN_USER) einem einzelnen Raum/Space beitreten lassen.
# roomId akzeptiert Room-ID (!...), Alias (#...) oder den logischen Namen aus "room list"/"space list".
# Funktioniert nur fuer oeffentliche Raeume: der Admin-Join-Endpoint (und auch die
# "!admin users force-join-room"/"force-promote"-Bot-Befehle) lehnen restricted und private
# Raeume mit demselben Auth-Check ab wie ein regulaerer Join. Fuer solche Raeume hilft nur ein
# regulaerer Invite durch ein bestehendes Mitglied.
node bin/matrix-admin.js join '!roomid:example.org'
node bin/matrix-admin.js join 'Allgemein'
node bin/matrix-admin.js join 'Allgemein' --user @testuser:example.org

# Aktuellen Admin-User (aus MATRIX_ADMIN_USER) allen Raeumen und Spaces beitreten lassen
node bin/matrix-admin.js join-all --dry-run
node bin/matrix-admin.js join-all
```

Alternativ nach `npm link`:

```bash
matrix-admin whoami
```

## Web-UI

Leichtgewichtige interaktive Web-Oberflaeche (Express-Server + Vanilla-JS-Frontend ohne
Build-Step/Framework) fuer Baumansicht, Mitglieder-Uebersicht sowie Erstellen/Verschieben/Loeschen
von Raeumen und Spaces (Loeschen erfordert eine Bestaetigung im Dialog, da es unwiderruflich ist):

```bash
npm run web
# oder: node bin/matrix-admin.js serve --port 3000
```

Danach `http://localhost:3000` oeffnen. Anders als die CLI-Befehle nutzt die Web-UI **keinen**
fest konfigurierten Admin-Account aus der `.env` - jede Person meldet sich im Browser mit den
eigenen Matrix-Zugangsdaten an (echter `POST /_matrix/client/v3/login`, Access-Token landet in
einem httpOnly-Cookie, kein serverseitiger Session-Store). Fuer die Web-UI werden daher nur
`MATRIX_HOMESERVER_URL` und `MATRIX_SERVER_NAME` in der `.env` benoetigt; die restlichen Funktionen
(Baum lesen, Raeume/Spaces anlegen, verschieben) erfordern serverseitig ausreichend Rechte
(Server-Admin fuer die Baumansicht via Synapse Admin API, `state_default`-Power im jeweiligen Space
fuer Erstellen/Verschieben) des eingeloggten Accounts.

Benutzerspezifische Funktionen (z.B. Provisioning einzelner Nutzer ueber die Web-UI) sind bewusst
noch nicht enthalten und folgen in einem spaeteren Schritt.

## Struktur

```
bin/matrix-admin.js     CLI-Einstiegspunkt
src/cli.js               Command-Definitionen (commander)
src/config.js             Laedt/validiert .env-Konfiguration
src/matrixClient.js       Client-Stub fuer die Matrix Admin API
src/commands/             Ein Modul pro Subcommand
src/web/server.js         Express-Backend fuer die Web-UI (Login-Cookie, JSON-API)
public/                   Statisches Web-UI-Frontend (HTML/CSS/Vanilla JS, kein Build-Step)
```
