#!/usr/bin/env node
import { runStdioServer } from './index.js';
const cdpUrl = process.env['AGENT_DEVTOOLS_CDP_URL'];
if (!cdpUrl) { process.stderr.write('AGENT_DEVTOOLS_CDP_URL is required\n'); process.exitCode = 1; }
else await runStdioServer({ cdpUrl });
