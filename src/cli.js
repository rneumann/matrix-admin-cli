// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

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
    .description('CLI tools for testing user provisioning on a Matrix server')
    .version('0.1.0');

  program
    .command('whoami')
    .description('Show configuration and test the connection to the homeserver')
    .action(whoamiCommand);

  const user = program
    .command('user')
    .description('User provisioning');

  user
    .command('create <localpart>')
    .description('Create a new user (e.g. "testuser" -> @testuser:server_name)')
    .option('-p, --password <password>', 'Initial password')
    .option('--admin', 'Create the user as a server admin', false)
    .action(userCreateCommand);

  user
    .command('list')
    .description('List existing users')
    .option('--limit <n>', 'Maximum number of results', '50')
    .action(userListCommand);

  user
    .command('deactivate <userId>')
    .description('Deactivate a user (full Matrix ID, e.g. @testuser:server_name)')
    .option('--erase', 'Also erase all user data', false)
    .action(userDeactivateCommand);

  user
    .command('info <userId>')
    .description(
      'Overview of a user: name, permissions, rooms, spaces (localpart e.g. "testuser" or full user ID)'
    )
    .option('--json', 'Output as a JSON record', false)
    .action(userInfoCommand);

  user
    .command('check-password <userId>')
    .description(
      'Validate a password via a real login attempt ("bind"), the session is logged out immediately. ' +
        'Without --password you are prompted interactively (masked input).'
    )
    .option('-p, --password <password>', 'Password to check (otherwise prompted, or MATRIX_CHECK_PASSWORD)')
    .action(userCheckPasswordCommand);

  const room = program
    .command('room')
    .description('Rooms (read-only)');

  room
    .command('list')
    .description('List rooms on the server')
    .option('--limit <n>', 'Maximum number of results', '50')
    .option('--search <term>', 'Filter by room name/alias (search_term)')
    .action(roomListCommand);

  room
    .command('power-levels <roomId>')
    .description(
      'Show a room\'s m.room.power_levels event (room ID, alias, or room name). ' +
        'Use --user to resolve the effective level for a user.'
    )
    .option('--user <userId>', 'Resolve the power level for this user (explicit or users_default)')
    .action(roomPowerLevelsCommand);

  room
    .command('promote <roomId>')
    .description(
      'Sets the power level of a user already in the room via ' +
        '"!admin users force-promote" in the server admin room (MATRIX_ADMIN_ROOM_ID). Does not cause a join.'
    )
    .option('--user <userId>', 'Target user instead of the current admin user (see whoami)')
    .action(roomPromoteCommand);

  const space = program
    .command('space')
    .description('Spaces (read-only)');

  space
    .command('list')
    .description('List spaces on the server (rooms with room_type m.space)')
    .option('--limit <n>', 'Maximum number of results', '50')
    .option('--search <term>', 'Filter by space name/alias (search_term)')
    .action(spaceListCommand);

  space
    .command('members <spaceId>')
    .description('List a space\'s members (room ID, alias, or space name)')
    .action(spaceMembersCommand);

  space
    .command('is-member <spaceId> <userId>')
    .description('Check whether a user is a member of a space (room ID, alias, or space name)')
    .action(spaceIsMemberCommand);

  space
    .command('tree')
    .description(
      'Hierarchical listing of all spaces/rooms on the server (nesting via m.space.child)'
    )
    .option('--root <spaceIdOrAlias>', 'Only show the subtree starting at this space (instead of all top-level nodes)')
    .action(spaceTreeCommand);

  program
    .command('move <roomIdOrAlias>')
    .description(
      'Moves a room or space into another space, or to the top level ' +
        '(room ID, alias, or name; removes m.space.child from the parent space(s) and sets it on the target space)'
    )
    .option('--to <spaceIdOrAlias>', 'Target space to move into')
    .option('--top-level', 'Move to the top level (remove from all parent spaces)', false)
    .option(
      '--from <spaceIdOrAlias>',
      'Only remove from this one parent space, instead of from all currently found'
    )
    .action(moveCommand);

  program
    .command('delete <roomIdOrAlias>')
    .description(
      'Permanently deletes a room/space from the server (Synapse Admin API, purge - including all messages). ' +
        'Requires --yes to confirm.'
    )
    .option('--yes', 'Confirms the permanent deletion', false)
    .action(deleteCommand);

  program
    .command('join <roomIdOrAlias>')
    .description(
      'Join a single room or space (room ID, alias, or room name as shown by "room list"/"space list")'
    )
    .option('--user <userId>', 'Have another user join instead of the current admin user (see whoami)')
    .action(joinCommand);

  program
    .command('join-all')
    .description(
      'Have the current admin user (see whoami) join all rooms and spaces on the server via the admin API'
    )
    .option('--dry-run', 'Only show which rooms would be joined, without actually joining', false)
    .action(joinAllCommand);

  program
    .command('grant-admin <roomIdOrAlias>')
    .description(
      'Makes MATRIX_TARGET_USER an admin (power level) in a room: the current admin ' +
        '(MATRIX_ADMIN_USER, must already be a member) invites, MATRIX_TARGET_USER accepts itself, ' +
        'the power level is set. Requires MATRIX_TARGET_USER/MATRIX_TARGET_PASSWORD in .env.'
    )
    .option('--level <n>', 'Target power level', '100')
    .action(grantAdminCommand);

  program
    .command('serve')
    .description(
      'Starts the interactive web UI (per-session login, tree view, members by power level, ' +
        'create and move spaces/rooms)'
    )
    .option('--port <n>', 'Port for the web server', '3000')
    .action(serveCommand);

  program
    .command('grant-admin-all')
    .description(
      'Like grant-admin, but for all rooms/spaces in which MATRIX_ADMIN_USER already has sufficient power.'
    )
    .option('--level <n>', 'Target power level', '100')
    .option('--dry-run', 'Only show which rooms admin rights would be granted for', false)
    .action(grantAdminAllCommand);

  return program;
}
