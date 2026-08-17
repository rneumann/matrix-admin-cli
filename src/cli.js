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
import { userCheckPasswordCommand } from './commands/userCheckPassword.js';

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
      'm.room.power_levels Event eines Raums anzeigen. Mit --user den effektiven Level fuer einen Benutzer aufloesen.'
    )
    .option('--user <userId>', 'Power-Level fuer diesen Benutzer aufloesen (explizit oder users_default)')
    .action(roomPowerLevelsCommand);

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
    .description('Mitglieder eines Space auflisten (vollstaendige Room-ID, z.B. !abc123:server_name)')
    .action(spaceMembersCommand);

  space
    .command('is-member <spaceId> <userId>')
    .description('Prueft, ob ein Benutzer Mitglied eines Space ist')
    .action(spaceIsMemberCommand);

  return program;
}
