# CLI agent help implementation

The catalog in `packages/cli/src/help.ts` remains the source for human and JSON help. It now describes generic ADP commands plus Angular adapter contributions and excludes V2 graph, diagnostics, replay and mutation commands.

Focused tests validate root and contextual help, JSON catalog uniqueness, group filtering, exit codes, unknown topics and browser-install arguments.
