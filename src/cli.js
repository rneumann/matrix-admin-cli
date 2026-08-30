import { Command } from 'commander';
import { whoamiCommand } from './commands/whoami.js';
import { userCreateCommand } from './commands/userCreate.js';
import { userListCommand } from './commands/userList.js';
import { userDeactivateCommand } from './commands/userDeactivate.js';
import { userInfoCommand } from './commands/userInfo.js';
import { roomListCommand } from './commands/roomList.js';
import { spaceListCommand } from './commands/spaceList.js';
import { spaceMembersCommand } from './commands/spaceMembers.js';
import { spaceIsMemberCommand } from './commands/spaceIsMember.js';
import { roomPowerLevelsCommand } from './commands/roomPowerLevels.js';
import { roomPromoteCommand } from './commands/roomPromote.js';
import { userCheckPasswordCommand } from './commands/userCheckPassword.js';
import { joinCommand } from './commands/join.js';
import { joinAllCommand } from './commands/joinAll.js';
import { grantAdminCommand } from './commands/grantAdmin.js';
import { grantAdminAllCommand } from './commands/grantAdminAll.js';
import { moveCommand } from './commands/move.js';
import { spaceTreeCommand } from './commands/spaceTree.js';
import { serveCommand } from './commands/serve.js';
import { deleteCommand } from './commands/delete.js';

export function buildCli() {
  const program = new Command();

  program
    .name('matrix-admin')
    .description('CLI-Tools zum Testen des Benutzer-Provisionings auf einem Matrix-Server')
    .version('0.1.0');

  program
    .command('whoami')
    .description('Konfiguration anzeigen und Verbindung zum Homeserver testen')
    .action(whoamiCommand);

  const user = program
    .command('user')
    .description('Benutzer-Provisioning');

  user
    .command('create <localpart>')
    .description('Neuen Benutzer anlegen (z.B. "testuser" -> @testuser:server_name)')
    .option('-p, --password <password>', 'Initiales Passwort')
    .option('--admin', 'Benutzer als Server-Admin anlegen', false)
    .action(userCreateCommand);

  user
    .command('list')
    .description('Bestehende Benutzer auflisten')
    .option('--limit <n>', 'Maximale Anzahl an Ergebnissen', '50')
    .action(userListCommand);

  user
    .command('deactivate <userId>')
    .description('Benutzer deaktivieren (vollstaendige Matrix-ID, z.B. @testuser:server_name)')
    .option('--erase', 'Zusaetzlich alle Nutzerdaten loeschen', false)
    .action(userDeactivateCommand);

  user
    .command('info <userId>')
    .description(
      'Uebersicht zu einem Benutzer: Name, Berechtigungen, Raeume, Spaces (Localpart z.B. "womi0003" oder volle User-ID)'
    )
    .option('--json', 'Ausgabe als JSON-Record', false)
    .action(userInfoCommand);

  user
    .command('check-password <userId>')
    .description(
      'Passwort per echtem Login-Versuch validieren ("bind"), Session wird sofort wieder ausgeloggt. ' +
        'Ohne --password wird interaktiv (maskiert) danach gefragt.'
    )
    .option('-p, --password <password>', 'Zu pruefendes Passwort (sonst Prompt bzw. MATRIX_CHECK_PASSWORD)')
    .action(userCheckPasswordCommand);

  const room = program
    .command('room')
    .description('Raeume (readonly)');

  room
    .command('list')
    .description('Raeume auf dem Server auflisten')
    .option('--limit <n>', 'Maximale Anzahl an Ergebnissen', '50')
    .option('--search <term>', 'Nach Raumname/-alias filtern (search_term)')
    .action(roomListCommand);

  room
    .command('power-levels <roomId>')
    .description(
      'm.room.power_levels Event eines Raums anzeigen (Room-ID, Alias oder Raumname). ' +
        'Mit --user den effektiven Level fuer einen Benutzer aufloesen.'
    )
    .option('--user <userId>', 'Power-Level fuer diesen Benutzer aufloesen (explizit oder users_default)')
    .action(roomPowerLevelsCommand);

  room
    .command('promote <roomId>')
    .description(
      'Setzt den Power-Level eines (bereits im Raum befindlichen) Benutzers per ' +
        '"!admin users force-promote" im Server-Admin-Room (MATRIX_ADMIN_ROOM_ID). Bewirkt keinen Join.'
    )
    .option('--user <userId>', 'Zielbenutzer statt des aktuellen Admin-Users (siehe whoami)')
    .action(roomPromoteCommand);

  const space = program
    .command('space')
    .description('Spaces (readonly)');

  space
    .command('list')
    .description('Spaces auf dem Server auflisten (Raeume mit room_type m.space)')
    .option('--limit <n>', 'Maximale Anzahl an Ergebnissen', '50')
    .option('--search <term>', 'Nach Space-Name/-alias filtern (search_term)')
    .action(spaceListCommand);

  space
    .command('members <spaceId>')
    .description('Mitglieder eines Space auflisten (Room-ID, Alias oder Space-Name)')
    .action(spaceMembersCommand);

  space
    .command('is-member <spaceId> <userId>')
    .description('Prueft, ob ein Benutzer Mitglied eines Space ist (Room-ID, Alias oder Space-Name)')
    .action(spaceIsMemberCommand);

  space
    .command('tree')
    .description(
      'Hierarchische Ausgabe aller Spaces/Raeume auf dem Server (Verschachtelung ueber m.space.child)'
    )
    .option('--root <spaceIdOrAlias>', 'Nur den Teilbaum ab diesem Space anzeigen (statt aller Toplevel-Knoten)')
    .action(spaceTreeCommand);

  program
    .command('move <roomIdOrAlias>')
    .description(
      'Verschiebt einen Raum oder Space in einen anderen Space, oder auf Toplevel-Ebene ' +
        '(Root-ID, Alias oder Name; entfernt m.space.child im/aus dem/den Eltern-Space(s) und setzt es im Ziel-Space)'
    )
    .option('--to <spaceIdOrAlias>', 'Ziel-Space, in den verschoben werden soll')
    .option('--top-level', 'Auf Toplevel-Ebene verschieben (aus allen Eltern-Spaces entfernen)', false)
    .option(
      '--from <spaceIdOrAlias>',
      'Nur aus diesem einen Eltern-Space entfernen, statt aus allen aktuell gefundenen'
    )
    .action(moveCommand);

  program
    .command('delete <roomIdOrAlias>')
    .description(
      'Loescht einen Raum/Space unwiderruflich vom Server (Synapse Admin API, purge - inkl. aller Nachrichten). ' +
        'Erfordert --yes zur Bestaetigung.'
    )
    .option('--yes', 'Bestaetigt das unwiderrufliche Loeschen', false)
    .action(deleteCommand);

  program
    .command('join <roomIdOrAlias>')
    .description(
      'Einzelnen Raum oder Space beitreten (Room-ID, Alias oder Raumname wie in "room list"/"space list" angezeigt)'
    )
    .option('--user <userId>', 'Anderen Benutzer beitreten lassen statt des aktuellen Admin-Users (siehe whoami)')
    .action(joinCommand);

  program
    .command('join-all')
    .description(
      'Aktuellen Admin-User (siehe whoami) per Admin-API allen Raeumen und Spaces auf dem Server beitreten lassen'
    )
    .option('--dry-run', 'Nur anzeigen, welchen Raeumen beigetreten wuerde, ohne tatsaechlich beizutreten', false)
    .action(joinAllCommand);

  program
    .command('grant-admin <roomIdOrAlias>')
    .description(
      'Macht MATRIX_TARGET_USER zum Admin (Power-Level) in einem Raum: der aktuelle Admin ' +
        '(MATRIX_ADMIN_USER, muss bereits Mitglied sein) laedt ein, MATRIX_TARGET_USER nimmt selbst an, ' +
        'Power-Level wird gesetzt. Erfordert MATRIX_TARGET_USER/MATRIX_TARGET_PASSWORD in der .env.'
    )
    .option('--level <n>', 'Ziel-Power-Level', '100')
    .action(grantAdminCommand);

  program
    .command('serve')
    .description(
      'Startet die interaktive Web-UI (eigener Login pro Session, Baumansicht, Mitglieder nach Power-Level, ' +
        'Spaces/Raeume erstellen und verschieben)'
    )
    .option('--port <n>', 'Port fuer den Web-Server', '3000')
    .action(serveCommand);

  program
    .command('grant-admin-all')
    .description(
      'Wie grant-admin, aber fuer alle Raeume/Spaces, in denen MATRIX_ADMIN_USER bereits ausreichend Power hat.'
    )
    .option('--level <n>', 'Ziel-Power-Level', '100')
    .option('--dry-run', 'Nur anzeigen, fuer welche Raeume Admin-Rechte vergeben wuerden', false)
    .action(grantAdminAllCommand);

  return program;
}
