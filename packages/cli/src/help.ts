export interface CliHelpOption {
  name: string;
  value?: string;
  description: string;
  default?: string | number | boolean;
  choices?: string[];
}

export interface CliHelpArgument {
  name: string;
  required: boolean;
  description: string;
}

export interface CliHelpCommand {
  path: string[];
  usage: string;
  summary: string;
  arguments?: CliHelpArgument[];
  options?: string[];
  examples: string[];
  output: string;
}

export interface CliHelpDocument {
  schemaVersion: '1.0.0';
  name: 'agent-devtools';
  description: string;
  protocolVersion: '1.0.0';
  path: string[];
  globalOptions: CliHelpOption[];
  exitCodes: Array<{ code: number; meaning: string }>;
  commands: CliHelpCommand[];
}

export const CLI_GLOBAL_OPTIONS: CliHelpOption[] = [
  { name: '--json', description: 'Emit one JSON document on stdout.', default: false },
  { name: '--jsonl', description: 'Emit one JSON object per line for streams.', default: false },
  { name: '--quiet', description: 'Suppress successful output.', default: false },
  { name: '--timeout', value: '<ms>', description: 'Browser operation timeout in milliseconds.', default: 10_000 },
  { name: '--headed', description: 'Launch Chromium with a visible window.', default: false },
  { name: '--help, -h', description: 'Show contextual help without opening a browser session.', default: false },
];

const arg = (name: string, description: string, required = true): CliHelpArgument => ({ name, required, description });
const command = (
  usage: string,
  summary: string,
  output: string,
  examples: string[],
  options: string[] = [],
  args: CliHelpArgument[] = [],
): CliHelpCommand => ({ path: usage.split(' ').filter(part => !part.startsWith('<') && !part.startsWith('[')), usage: `agent-devtools ${usage}`, summary, ...(args.length ? { arguments: args } : {}), ...(options.length ? { options } : {}), examples, output });

export const CLI_COMMANDS: CliHelpCommand[] = [
  command('open <url>', 'Launch Chromium and create the active session.', 'Session metadata.', ['agent-devtools open http://localhost:4200', 'agent-devtools open http://localhost:4200 --headed'], ['--headed', '--timeout'], [arg('url', 'Development application URL.')]),
  command('install [browser...]', 'Install Playwright browsers required by agent-devtools.', 'Installed browser names.', ['agent-devtools install', 'agent-devtools install chromium firefox webkit', 'agent-devtools install chromium --with-deps'], ['--with-deps'], [arg('browser', 'chromium, firefox, or webkit; defaults to chromium.', false)]),
  command('connect', 'Connect to an existing browser through CDP.', 'Session metadata.', ['agent-devtools connect --cdp http://localhost:9222'], ['--cdp <url>', '--timeout']),
  command('status', 'Report active adapters, domains and capabilities.', 'ADP runtime status.', ['agent-devtools status --json']),
  command('close', 'Close the active browser session and release its resources.', 'Closure confirmation.', ['agent-devtools close --json']),
  command('snapshot', 'Capture a correlated multi-domain ADP snapshot.', 'Snapshot object.', ['agent-devtools snapshot --json', 'agent-devtools snapshot --scope current-route --compact', 'agent-devtools snapshot --name before-submit --json'], ['--scope <value>', '--compact', '--name <name>', '--json']),
  command('scene tree', 'Return the PixiJS scene graph.', 'Scene roots and node snapshots.', ['agent-devtools scene tree --json']),
  command('scene inspect <name-or-ref>', 'Inspect a PixiJS scene node by label or runtime reference.', 'At most one matching scene node.', ['agent-devtools scene inspect Player --json'], [], [arg('name-or-ref', 'PixiJS node label or runtime reference.')]),
  command('rendering info', 'Return PixiJS renderer metadata and scene counters.', 'Rendering domain snapshot.', ['agent-devtools rendering info --json']),
  command('assets textures', 'List PixiJS managed GPU texture metadata.', 'Texture snapshots.', ['agent-devtools assets textures --json']),
  command('components tree', 'List the component tree captured from the page.', 'Component snapshots.', ['agent-devtools components tree --json']),
  command('component inspect <name-or-ref>', 'Inspect a component by class name or runtime reference.', 'At most one matching component.', ['agent-devtools component inspect CheckoutComponent --json', 'agent-devtools component inspect cmp-12 --json'], [], [arg('name-or-ref', 'Component class name or cmp-* reference.')]),
  command('directive inspect <name>', 'Inspect a directive by name.', 'At most one matching directive.', ['agent-devtools directive inspect FormField --json'], [], [arg('name', 'Directive class name.')]),
  command('router tree', 'Return the serialized Router tree.', 'Route snapshots.', ['agent-devtools router tree --json']),
  command('router active', 'Return active routes and navigation state.', 'Active Router state.', ['agent-devtools router active --json']),
  command('router events', 'Return recent Router events.', 'Router event array.', ['agent-devtools router events --last 20 --json'], ['--last <count>']),
  command('di tree', 'Return element and environment injector hierarchies.', 'Injector snapshots.', ['agent-devtools di tree --json']),
  command('di injector <injector-ref>', 'Inspect one injector.', 'Injector snapshot or null.', ['agent-devtools di injector inj-42 --json'], [], [arg('injector-ref', 'inj-* runtime reference.')]),
  command('di providers [injector-ref]', 'List providers, optionally scoped to one injector.', 'Provider snapshots.', ['agent-devtools di providers --json', 'agent-devtools di providers inj-42 --json'], [], [arg('injector-ref', 'Optional inj-* runtime reference.', false)]),
  command('di resolve <token>', 'Explain provider resolution from a component or injector.', 'Provider resolution path.', ['agent-devtools di resolve AuthService --from cmp-12 --json'], ['--from <runtime-ref>'], [arg('token', 'Provider token name.')]),
  command('signals list', 'List discovered and instrumented Signals.', 'Signal snapshots.', ['agent-devtools signals list --json']),
  command('signals watch', 'Stream Signal changes until interrupted.', 'JSONL runtime events.', ['agent-devtools signals watch --jsonl'], ['--jsonl', '--last <count>']),
  command('signal inspect <signal-ref>', 'Inspect one Signal.', 'At most one matching Signal.', ['agent-devtools signal inspect sig-12 --json'], [], [arg('signal-ref', 'sig-* runtime reference.')]),
  command('forms list', 'List Reactive and template-driven forms.', 'Classic form snapshots.', ['agent-devtools forms list --json']),
  command('form inspect <form-ref>', 'Inspect one classic form.', 'At most one matching form.', ['agent-devtools form inspect form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('form errors <form-ref>', 'Collect all validation errors from a classic form.', 'Path and error entries.', ['agent-devtools form errors form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('form migrate <form-ref>', 'Generate a deterministic migration plan to Signal Forms.', 'Migration plan.', ['agent-devtools form migrate form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('signal-forms list', 'List Angular Signal Forms.', 'Signal Form snapshots.', ['agent-devtools signal-forms list --json']),
  command('signal-form inspect <form-ref>', 'Inspect one Signal Form.', 'At most one matching Signal Form.', ['agent-devtools signal-form inspect sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('signal-form field <form-ref:path>', 'Inspect a field by form reference and model path.', 'Signal Form field or null.', ['agent-devtools signal-form field sf-3:user.email --json'], [], [arg('form-ref:path', 'Signal Form reference and field path.')]),
  command('signal-form errors <form-ref>', 'Collect form-level and field-level errors.', 'Structured validation errors.', ['agent-devtools signal-form errors sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('signal-form assertions <form-ref>', 'Generate test assertions from a Signal Form snapshot.', 'Generated assertion model.', ['agent-devtools signal-form assertions sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('ngrx state', 'Return current NgRx Store snapshots.', 'NgRx store snapshots.', ['agent-devtools ngrx state --json']),
  command('ngrx actions', 'Return recent observed NgRx actions.', 'NgRx action events.', ['agent-devtools ngrx actions --last 20 --json'], ['--last <count>']),
  command('ngrx diff', 'Return recent observed NgRx state transitions.', 'Store change events.', ['agent-devtools ngrx diff --last 20 --json'], ['--last <count>']),
  command('signal-store list', 'List discovered NgRx SignalStore instances.', 'SignalStore snapshots.', ['agent-devtools signal-store list --json']),
  command('signal-store inspect <name-or-ref>', 'Inspect a SignalStore by stable name or reference.', 'SignalStore snapshot or null.', ['agent-devtools signal-store inspect CartStore --json'], [], [arg('name-or-ref', 'Store name or store-* reference.')]),
  command('profile start', 'Start Angular runtime profiling.', 'Profiling start confirmation.', ['agent-devtools profile start --json']),
  command('profile stop', 'Stop profiling and optionally write the result to disk.', 'Profile capture.', ['agent-devtools profile stop --output profile.json --json'], ['--output <file>']),
  command('profile summarize', 'Return the latest compact profile summary.', 'Profile summary or null.', ['agent-devtools profile summarize --json']),
  command('diff', 'Compare the current state with a named snapshot or JSON file.', 'Structured snapshot diff.', ['agent-devtools diff --from before-submit --json', 'agent-devtools diff --from snapshot.json --json'], ['--from <snapshot-id-or-json>']),
  command('watch', 'Stream every normalized runtime event until interrupted.', 'JSONL runtime events.', ['agent-devtools watch --jsonl'], ['--jsonl', '--last <count>']),
  command('query <domain> [field=value...]', 'Apply deterministic filters to an ADP domain resource.', 'Matching runtime values.', ['agent-devtools query components --resource components name=CheckoutComponent --json', 'agent-devtools query company.example/state status=ready --json'], ['--resource <name>', '--<field> <value>'], [arg('domain', 'Standard or namespaced ADP domain identifier.'), arg('field=value', 'Zero or more structured equality filters.', false)]),
  command('explain <kind> <runtime-ref>', 'Explain observed relations for a runtime reference.', 'Deterministic explanation with evidence.', ['agent-devtools explain component cmp-12 --json', 'agent-devtools explain field field-4 --json'], [], [arg('kind', 'Runtime reference kind.'), arg('runtime-ref', 'Stable runtime reference for the active generation.')]),
];

export const CLI_EXIT_CODES = [
  { code: 0, meaning: 'Success.' },
  { code: 1, meaning: 'Invalid command, arguments, or unexpected CLI failure.' },
  { code: 2, meaning: 'No session, browser connection failure, or timeout.' },
  { code: 3, meaning: 'No supported adapter is available or the only Angular adapter is not inspectable.' },
  { code: 4, meaning: 'Missing or stale runtime reference.' },
];

const startsWithPath = (commandPath: string[], requested: string[]) => requested.every((part, index) => commandPath[index] === part);

export function createHelpDocument(path: string[] = []): CliHelpDocument {
  const commands = path.length ? CLI_COMMANDS.filter(item => startsWithPath(item.path, path)) : CLI_COMMANDS;
  if (!commands.length) throw new Error(`Unknown help topic: ${path.join(' ')}`);
  return { schemaVersion: '1.0.0', name: 'agent-devtools', description: 'ADP runtime inspection with Angular and PixiJS adapters', protocolVersion: '1.0.0', path, globalOptions: CLI_GLOBAL_OPTIONS, exitCodes: CLI_EXIT_CODES, commands };
}

export function resolveContextualHelpPath(positional: string[]): string[] {
  const matches = CLI_COMMANDS.filter(item => startsWithPath(positional, item.path)).sort((left, right) => right.path.length - left.path.length);
  return matches[0]?.path ?? positional;
}

export function renderHelp(document: CliHelpDocument): string {
  const title = document.path.length ? `agent-devtools ${document.path.join(' ')}` : 'agent-devtools';
  const exactCommand = document.commands.length === 1 && document.commands[0]?.path.length === document.path.length ? document.commands[0] : undefined;
  const lines = [`${title} — ${document.description}`, ''];
  if (exactCommand) {
    lines.push(`Usage: ${exactCommand.usage}`, '', exactCommand.summary);
  } else {
    lines.push(document.path.length ? 'Available commands:' : 'Usage: agent-devtools <command> [options]\n\nCommands:');
    for (const item of document.commands) {
      lines.push(`  ${item.usage.slice('agent-devtools '.length).padEnd(42)} ${item.summary}`);
    }
  }
  lines.push('', 'Global options:');
  for (const option of document.globalOptions) lines.push(`  ${(option.value ? `${option.name} ${option.value}` : option.name).padEnd(30)} ${option.description}`);
  if (exactCommand) {
    const item = exactCommand;
    if (item.arguments?.length) {
      lines.push('', 'Arguments:');
      for (const argument of item.arguments) lines.push(`  ${argument.name.padEnd(24)} ${argument.description}${argument.required ? '' : ' (optional)'}`);
    }
    if (item.options?.length) lines.push('', `Command options: ${item.options.join(', ')}`);
    lines.push('', `Output: ${item.output}`, '', 'Examples:', ...item.examples.map(example => `  ${example}`));
  }
  lines.push('', 'Machine-readable catalog: agent-devtools help --json', 'Exit codes: 0 success · 1 usage · 2 connection · 3 adapter unavailable · 4 stale ref', '');
  return lines.join('\n');
}
