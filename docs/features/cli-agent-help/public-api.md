# CLI agent help public API

The self-describing help catalog remains available through `agent-devtools help --json` and `agent-devtools commands --json`. Each command provides path, usage, summary, arguments, options, examples and output description. V1 no longer exposes mutation metadata because it contains no mutation commands.

Unknown topics emit `CLI_ERROR` on stderr and return exit code 1. See the current [CLI contract](../../cli.md).
