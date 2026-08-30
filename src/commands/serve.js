// Copyright (c) 2026 Prof. Dr.-Ing. Rainer Neumann, Hochschule Karlsruhe
// SPDX-License-Identifier: MIT

import { requireHomeserverConfig } from '../config.js';
import { createServer } from '../web/server.js';

export async function serveCommand(options) {
  const config = requireHomeserverConfig();
  const port = Number(options.port) || 3000;

  const app = createServer(config);
  app.listen(port, () => {
    console.log(`Matrix Admin web UI running at http://localhost:${port}`);
  });
}
