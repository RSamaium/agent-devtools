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
  mutation: boolean;
}

export interface CliHelpDocument {
  schemaVersion: '1.0.0';
  name: 'ng-agent';
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
  mutation = false,
): CliHelpCommand => ({ path: usage.split(' ').filter(part => !part.startsWith('<') && !part.startsWith('[')), usage: `ng-agent ${usage}`, summary, ...(args.length ? { arguments: args } : {}), ...(options.length ? { options } : {}), examples, output, mutation });

export const CLI_COMMANDS: CliHelpCommand[] = [
  command('open <url>', 'Launch Chromium and create the active session.', 'Session metadata.', ['ng-agent open http://localhost:4200', 'ng-agent open http://localhost:4200 --headed'], ['--headed', '--timeout'], [arg('url', 'Angular development application URL.')]),
  command('install [browser...]', 'Install Playwright browsers required by ng-agent.', 'Installed browser names.', ['ng-agent install', 'ng-agent install chromium firefox webkit', 'ng-agent install chromium --with-deps'], ['--with-deps'], [arg('browser', 'chromium, firefox, or webkit; defaults to chromium.', false)]),
  command('connect', 'Connect to an existing browser through CDP.', 'Session metadata.', ['ng-agent connect --cdp http://localhost:9222'], ['--cdp <url>', '--timeout']),
  command('status', 'Report Angular detection and runtime capabilities.', 'Runtime status.', ['ng-agent status --json']),
  command('close', 'Close the active browser session and release its resources.', 'Closure confirmation.', ['ng-agent close --json']),
  command('snapshot', 'Capture a correlated Angular runtime snapshot.', 'Snapshot object.', ['ng-agent snapshot --json', 'ng-agent snapshot --scope current-route --compact', 'ng-agent snapshot --name before-submit --json'], ['--scope <all|current-route>', '--compact', '--name <name>', '--json']),
  command('components tree', 'List the component tree captured from the page.', 'Component snapshots.', ['ng-agent components tree --json']),
  command('component inspect <name-or-ref>', 'Inspect a component by class name or runtime reference.', 'At most one matching component.', ['ng-agent component inspect CheckoutComponent --json', 'ng-agent component inspect cmp-12 --json'], [], [arg('name-or-ref', 'Component class name or cmp-* reference.')]),
  command('directive inspect <name>', 'Inspect a directive by name.', 'At most one matching directive.', ['ng-agent directive inspect FormField --json'], [], [arg('name', 'Directive class name.')]),
  command('router tree', 'Return the serialized Router tree.', 'Route snapshots.', ['ng-agent router tree --json']),
  command('router active', 'Return active routes and navigation state.', 'Active Router state.', ['ng-agent router active --json']),
  command('router events', 'Return recent Router events.', 'Router event array.', ['ng-agent router events --last 20 --json'], ['--last <count>']),
  command('di tree', 'Return element and environment injector hierarchies.', 'Injector snapshots.', ['ng-agent di tree --json']),
  command('di injector <injector-ref>', 'Inspect one injector.', 'Injector snapshot or null.', ['ng-agent di injector inj-42 --json'], [], [arg('injector-ref', 'inj-* runtime reference.')]),
  command('di providers [injector-ref]', 'List providers, optionally scoped to one injector.', 'Provider snapshots.', ['ng-agent di providers --json', 'ng-agent di providers inj-42 --json'], [], [arg('injector-ref', 'Optional inj-* runtime reference.', false)]),
  command('di resolve <token>', 'Explain provider resolution from a component or injector.', 'Provider resolution path.', ['ng-agent di resolve AuthService --from cmp-12 --json'], ['--from <runtime-ref>'], [arg('token', 'Provider token name.')]),
  command('signals list', 'List discovered and instrumented Signals.', 'Signal snapshots.', ['ng-agent signals list --json']),
  command('signals watch', 'Stream Signal changes until interrupted.', 'JSONL runtime events.', ['ng-agent signals watch --jsonl'], ['--jsonl', '--last <count>']),
  command('signal inspect <signal-ref>', 'Inspect one Signal.', 'At most one matching Signal.', ['ng-agent signal inspect sig-12 --json'], [], [arg('signal-ref', 'sig-* runtime reference.')]),
  command('forms list', 'List Reactive and template-driven forms.', 'Classic form snapshots.', ['ng-agent forms list --json']),
  command('form inspect <form-ref>', 'Inspect one classic form.', 'At most one matching form.', ['ng-agent form inspect form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('form errors <form-ref>', 'Collect all validation errors from a classic form.', 'Path and error entries.', ['ng-agent form errors form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('form migrate <form-ref>', 'Generate a deterministic migration plan to Signal Forms.', 'Migration plan.', ['ng-agent form migrate form-3 --json'], [], [arg('form-ref', 'form-* runtime reference.')]),
  command('signal-forms list', 'List Angular Signal Forms.', 'Signal Form snapshots.', ['ng-agent signal-forms list --json']),
  command('signal-form inspect <form-ref>', 'Inspect one Signal Form.', 'At most one matching Signal Form.', ['ng-agent signal-form inspect sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('signal-form field <form-ref:path>', 'Inspect a field by form reference and model path.', 'Signal Form field or null.', ['ng-agent signal-form field sf-3:user.email --json'], [], [arg('form-ref:path', 'Signal Form reference and field path.')]),
  command('signal-form errors <form-ref>', 'Collect form-level and field-level errors.', 'Structured validation errors.', ['ng-agent signal-form errors sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('signal-form assertions <form-ref>', 'Generate test assertions from a Signal Form snapshot.', 'Generated assertion model.', ['ng-agent signal-form assertions sf-3 --json'], [], [arg('form-ref', 'sf-* runtime reference.')]),
  command('ngrx state', 'Return current NgRx Store snapshots.', 'NgRx store snapshots.', ['ng-agent ngrx state --json']),
  command('ngrx actions', 'Return recent observed NgRx actions.', 'NgRx action events.', ['ng-agent ngrx actions --last 20 --json'], ['--last <count>']),
  command('ngrx diff', 'Return recent observed NgRx state transitions.', 'Store change events.', ['ng-agent ngrx diff --last 20 --json'], ['--last <count>']),
  command('signal-store list', 'List discovered NgRx SignalStore instances.', 'SignalStore snapshots.', ['ng-agent signal-store list --json']),
  command('signal-store inspect <name-or-ref>', 'Inspect a SignalStore by stable name or reference.', 'SignalStore snapshot or null.', ['ng-agent signal-store inspect CartStore --json'], [], [arg('name-or-ref', 'Store name or store-* reference.')]),
  command('profile start', 'Start Angular runtime profiling.', 'Profiling start confirmation.', ['ng-agent profile start --json']),
  command('profile stop', 'Stop profiling and optionally write the result to disk.', 'Profile capture.', ['ng-agent profile stop --output profile.json --json'], ['--output <file>']),
  command('profile summarize', 'Return the latest compact profile summary.', 'Profile summary or null.', ['ng-agent profile summarize --json']),
  command('trace start', 'Start causal event tracing.', 'Trace start confirmation.', ['ng-agent trace start --json']),
  command('trace stop', 'Stop causal tracing and return correlated steps.', 'Causal trace.', ['ng-agent trace stop --json']),
  command('click <selector-or-ref>', 'Click an element and record the interaction.', 'Interaction result.', ['ng-agent click @e42 --json', 'ng-agent click "button[type=submit]" --json'], [], [arg('selector-or-ref', 'CSS selector or @e* element reference.')]),
  command('session export', 'Export snapshots and events from the active session.', 'Portable session document.', ['ng-agent session export --output session.json --json'], ['--output <file>']),
  command('session import <file>', 'Import snapshots and events into the active runtime.', 'Import summary.', ['ng-agent session import session.json --json'], [], [arg('file', 'Session JSON file.')]),
  command('replay <file>', 'Replay a session in dry-run mode by default.', 'Replay report.', ['ng-agent replay session.json --json', 'ng-agent replay session.json --apply --json'], ['--apply'], [arg('file', 'Session JSON file.')]),
  command('diff', 'Compare the current state with a named snapshot or JSON file.', 'Structured snapshot diff.', ['ng-agent diff --from before-submit --json', 'ng-agent diff --from snapshot.json --json'], ['--from <snapshot-id-or-json>']),
  command('watch', 'Stream every normalized runtime event until interrupted.', 'JSONL runtime events.', ['ng-agent watch --jsonl'], ['--jsonl', '--last <count>']),
  command('query <domain> [field=value...]', 'Apply deterministic structured filters to a snapshot domain.', 'Matching runtime snapshots.', ['ng-agent query components name=CheckoutComponent --json', 'ng-agent query fields invalid=true --json'], ['--<field> <value>'], [arg('domain', 'components, directives, providers, signals, forms, signal-forms, fields, routes, or stores.'), arg('field=value', 'Zero or more structured equality filters.', false)]),
  command('explain <kind> <runtime-ref>', 'Explain observed relations for a runtime reference.', 'Deterministic explanation with evidence.', ['ng-agent explain component cmp-12 --json', 'ng-agent explain field field-4 --json'], [], [arg('kind', 'Runtime reference kind.'), arg('runtime-ref', 'Stable runtime reference for the active generation.')]),
  command('graph', 'Return the cross-domain dependency graph.', 'Nodes and typed edges.', ['ng-agent graph --json']),
  command('diagnostics', 'Run deterministic runtime diagnostics.', 'Diagnostics with evidence and confidence.', ['ng-agent diagnostics --json']),
  command('signal set <signal-ref> <value>', 'Set an allowlisted writable Signal.', 'Mutation result and audit event.', ['ng-agent signal set sig-4 false --allow-mutations --capability-token local-secret --json'], ['--allow-mutations', '--capability-token <token>'], [arg('signal-ref', 'sig-* runtime reference.'), arg('value', 'JSON value or string.')], true),
  command('form set <field-ref> <value>', 'Set an allowlisted classic or Signal Form field.', 'Mutation result and audit event.', ['ng-agent form set field-4 "a@b.com" --allow-mutations --capability-token local-secret --json'], ['--allow-mutations', '--capability-token <token>'], [arg('field-ref', 'field-* runtime reference.'), arg('value', 'JSON value or string.')], true),
  command('router navigate <url>', 'Navigate through an allowlisted Router operation.', 'Mutation result and audit event.', ['ng-agent router navigate /checkout --allow-mutations --capability-token local-secret --json'], ['--allow-mutations', '--capability-token <token>'], [arg('url', 'Application-relative route URL.')], true),
  command('ngrx dispatch <action-json>', 'Dispatch an allowlisted NgRx action.', 'Mutation result and audit event.', [`ng-agent ngrx dispatch '{"type":"[Cart] Clear"}' --allow-mutations --capability-token local-secret --json`], ['--allow-mutations', '--capability-token <token>'], [arg('action-json', 'Serialized NgRx action.')], true),
];

export const CLI_EXIT_CODES = [
  { code: 0, meaning: 'Success.' },
  { code: 1, meaning: 'Invalid command, arguments, or unexpected CLI failure.' },
  { code: 2, meaning: 'No session, browser connection failure, or timeout.' },
  { code: 3, meaning: 'Angular absent or production build not inspectable.' },
  { code: 4, meaning: 'Missing or stale runtime reference.' },
  { code: 5, meaning: 'Mutation denied by the runtime security policy.' },
];

const startsWithPath = (commandPath: string[], requested: string[]) => requested.every((part, index) => commandPath[index] === part);

export function createHelpDocument(path: string[] = []): CliHelpDocument {
  const commands = path.length ? CLI_COMMANDS.filter(item => startsWithPath(item.path, path)) : CLI_COMMANDS;
  if (!commands.length) throw new Error(`Unknown help topic: ${path.join(' ')}`);
  return { schemaVersion: '1.0.0', name: 'ng-agent', description: 'Angular runtime inspection for development agents', protocolVersion: '1.0.0', path, globalOptions: CLI_GLOBAL_OPTIONS, exitCodes: CLI_EXIT_CODES, commands };
}

export function resolveContextualHelpPath(positional: string[]): string[] {
  const matches = CLI_COMMANDS.filter(item => startsWithPath(positional, item.path)).sort((left, right) => right.path.length - left.path.length);
  return matches[0]?.path ?? positional;
}

export function renderHelp(document: CliHelpDocument): string {
  const title = document.path.length ? `ng-agent ${document.path.join(' ')}` : 'ng-agent';
  const exactCommand = document.commands.length === 1 && document.commands[0]?.path.length === document.path.length ? document.commands[0] : undefined;
  const lines = [`${title} — ${document.description}`, ''];
  if (exactCommand) {
    lines.push(`Usage: ${exactCommand.usage}`, '', `${exactCommand.summary}${exactCommand.mutation ? ' [mutation]' : ''}`);
  } else {
    lines.push(document.path.length ? 'Available commands:' : 'Usage: ng-agent <command> [options]\n\nCommands:');
    for (const item of document.commands) {
      lines.push(`  ${item.usage.slice('ng-agent '.length).padEnd(42)} ${item.summary}${item.mutation ? ' [mutation]' : ''}`);
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
  lines.push('', 'Machine-readable catalog: ng-agent help --json', 'Exit codes: 0 success · 1 usage · 2 connection · 3 Angular unavailable · 4 stale ref · 5 mutation denied', '');
  return lines.join('\n');
}
