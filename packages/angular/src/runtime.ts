import type {
  AdapterCapture, CaptureAdapter, RuntimeAdapter, RuntimeContext,
} from '@agent-devtools/runtime';
import type {
  AdapterDescriptor, ApplicationMetadata, Explanation, ProfileSnapshot, ResolutionSnapshot,
  RuntimeRef, SerializedValue, StandardCaptureSnapshot,
} from '@agent-devtools/protocol';
import { getInstrumentation, serialize } from '@agent-devtools/runtime';
import { AngularDiscoveryAdapter, componentsAdapter } from '@agent-devtools/internal-angular-components';
import { routerAdapter } from '@agent-devtools/internal-angular-router';
import { diAdapter } from '@agent-devtools/internal-angular-di';
import { signalsAdapter } from '@agent-devtools/internal-angular-signals';
import { formsAdapter } from '@agent-devtools/internal-angular-forms';
import { signalFormsAdapter } from '@agent-devtools/internal-angular-signal-forms';
import { ngrxStoreAdapter } from '@agent-devtools/internal-angular-ngrx-store';
import { ngrxSignalStoreAdapter } from '@agent-devtools/internal-angular-ngrx-signal-store';
import { profilerAdapter } from '@agent-devtools/internal-angular-profiler';

const domain = (id: string, capabilities: string[], commands?: AdapterDescriptor['domains'][number]['commands']) => ({ id, version: '1.0.0', capabilities, ...(commands ? { commands } : {}) });

export class AngularRuntimeAdapter implements RuntimeAdapter {
  private latest?: StandardCaptureSnapshot;
  private profileStartedAt: number | undefined;
  private emittedInstrumentationEvents = 0;
  private readonly modules: Array<CaptureAdapter<StandardCaptureSnapshot>> = [
    new AngularDiscoveryAdapter(), componentsAdapter(), diAdapter(), routerAdapter(), signalsAdapter(),
    formsAdapter(), signalFormsAdapter(), ngrxStoreAdapter(), ngrxSignalStoreAdapter(), profilerAdapter(),
  ].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  get descriptor(): AdapterDescriptor {
    return {
      id: 'angular', name: 'Angular Adapter', version: '0.1.0', protocolRange: '^1.0.0',
      framework: { name: 'angular', ...(this.latest?.application.version ? { version: this.latest.application.version } : {}) },
      domains: [
        domain('application', ['angular.runtime']),
        domain('components', ['angular.components', 'angular.directives']),
        domain('routing', ['angular.router']),
        domain('dependency-injection', ['angular.di'], [{ name: 'resolve', description: 'Explain observed provider resolution.' }]),
        domain('state', ['angular.signals', 'angular.ngrx.store', 'angular.ngrx.signal-store']),
        domain('forms', ['angular.forms.reactive', 'angular.forms.template', 'angular.forms.signal']),
        domain('performance', ['angular.profiler'], [
          { name: 'start', description: 'Start a profiling window.' },
          { name: 'stop', description: 'Stop the active profiling window.' },
        ]),
      ],
      capabilities: ['snapshot', 'query', 'events', 'explain', 'diff'],
    };
  }

  isAvailable(context: RuntimeContext): boolean {
    return !!(context.window as unknown as { ng?: unknown }).ng || !!context.document.querySelector('[ng-version]');
  }

  async capture(context: RuntimeContext): Promise<AdapterCapture> {
    const version = detectVersion(context.window);
    const devMode = !!(context.window as unknown as { ng?: unknown }).ng;
    const application: ApplicationMetadata = {
      framework: 'angular', detected: true, ...(version ? { version } : {}), devMode, roots: [],
      discovery: getInstrumentation(context.window) ? 'instrumented' : devMode ? 'partial' : 'partial',
    };
    const snapshot: StandardCaptureSnapshot = {
      id: crypto.randomUUID(), generation: context.refs.generation,
      runtime: { environment: 'web', url: context.window.location.href, title: context.document.title, userAgent: context.window.navigator.userAgent, capturedAt: Date.now() },
      application, components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings: [], truncations: [],
    };
    if (!devMode) snapshot.warnings.push({ code: 'PRODUCTION_BUILD', message: 'Angular was detected without development debug APIs.', domain: 'application' });
    const configuredRedaction = getInstrumentation(context.window)?.options['redact'];
    const captureContext: RuntimeContext = {
      ...context,
      options: { ...context.options, budget: { ...context.options.budget, ...(Array.isArray(configuredRedaction) ? { redact: configuredRedaction.filter((item): item is string => typeof item === 'string') } : {}) } },
    };
    for (const module of this.modules) if (module.isAvailable(captureContext)) await module.capture(snapshot, captureContext);
    const hasSsrMarkers = !!context.document.querySelector('[ngh],[ng-server-context]') || !!context.document.body?.getAttribute('ng-server-context');
    snapshot.application.renderMode = hasSsrMarkers ? devMode ? 'hydrated' : 'ssr' : 'client';
    snapshot.application.multiRoot = snapshot.application.roots.length > 1;
    this.emitInstrumentation(captureContext);
    this.latest = snapshot;
    return {
      domains: {
        application: { id: 'application', version: '1.0.0', data: snapshot.application },
        components: { id: 'components', version: '1.0.0', data: { components: snapshot.components, directives: snapshot.directives } },
        routing: { id: 'routing', version: '1.0.0', data: snapshot.router ?? { activeUrl: context.window.location.pathname, roots: [], events: [], navigationInProgress: false } },
        'dependency-injection': { id: 'dependency-injection', version: '1.0.0', data: { injectors: snapshot.injectors, providers: snapshot.providers } },
        state: { id: 'state', version: '1.0.0', data: { signals: snapshot.signals, stores: snapshot.stores } },
        forms: { id: 'forms', version: '1.0.0', data: { forms: snapshot.forms, signalForms: snapshot.signalForms } },
        performance: { id: 'performance', version: '1.0.0', data: snapshot.profile ?? null },
      },
      warnings: snapshot.warnings, truncations: snapshot.truncations,
    };
  }

  execute(domainId: string, command: string, params: SerializedValue | undefined): SerializedValue {
    if (domainId === 'dependency-injection' && command === 'resolve') return this.resolveProvider(params) as unknown as SerializedValue;
    if (domainId === 'performance' && command === 'start') {
      this.profileStartedAt = performance.now();
      return { startedAt: this.profileStartedAt };
    }
    if (domainId === 'performance' && command === 'stop') {
      if (this.profileStartedAt === undefined) throw new Error('Profiling has not been started');
      const startedAt = this.profileStartedAt; this.profileStartedAt = undefined;
      const result: ProfileSnapshot = { startedAt, stoppedAt: performance.now(), entries: [{ name: 'profile-window', kind: 'cycle', start: startedAt, duration: performance.now() - startedAt }], budgetExceeded: false };
      return result as unknown as SerializedValue;
    }
    throw new Error(`Unsupported Angular command: ${domainId}.${command}`);
  }

  explain(subject: RuntimeRef | string): Explanation {
    const label = typeof subject === 'string' ? subject : `${subject.kind} ${subject.id}`;
    if (typeof subject === 'string' || !this.latest) return { subject, summary: label, facts: [], evidence: [], limitations: ['No matching captured runtime reference.'] };
    const facts: Explanation['facts'] = [];
    const component = this.latest.components.find(item => item.ref.id === subject.id);
    const signal = this.latest.signals.find(item => item.ref.id === subject.id);
    const signalForm = this.latest.signalForms.find(item => item.ref.id === subject.id || item.fields.some(field => field.ref.id === subject.id));
    if (component?.injector) facts.push({ relation: 'uses-injector', value: component.injector.id, confidence: 'observed' });
    if (signal?.owner) facts.push({ relation: 'owned-by', value: signal.owner.id, confidence: signal.discovery === 'instrumented' ? 'instrumented' : 'observed' });
    for (const error of signalForm?.fields.find(field => field.ref.id === subject.id)?.errors ?? signalForm?.errors ?? []) facts.push({ relation: 'invalid-because', value: { code: error.code, message: error.message ?? '' }, confidence: signalForm?.discovery === 'instrumented' ? 'instrumented' : 'observed' });
    return { subject, summary: `${label} has ${facts.length} observed relation(s).`, facts, evidence: [subject], limitations: ['Only observed and instrumented Angular relations are reported.'] };
  }

  private resolveProvider(params: SerializedValue | undefined): ResolutionSnapshot {
    const value = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
    const token = typeof value['token'] === 'string' ? value['token'] : '';
    const from = value['from'] as unknown as RuntimeRef;
    if (!this.latest || !from) throw new Error('A captured snapshot and source reference are required');
    if (from.generation !== this.latest.generation) throw new Error('STALE_REFERENCE');
    const start = from.kind === 'component' ? this.latest.components.find(item => item.ref.id === from.id)?.injector : from.kind === 'injector' ? from : undefined;
    if (!start) return { token, from, path: [], flags: [], error: 'Starting injector was not found', confidence: 'observed' };
    const injectors = new Map(this.latest.injectors.map(injector => [injector.ref.id, injector]));
    const path: RuntimeRef[] = []; let current = injectors.get(start.id); let winner: RuntimeRef | undefined;
    while (current) {
      path.push(current.ref);
      winner = current.providers.map(ref => this.latest?.providers.find(provider => provider.ref.id === ref.id)).find(provider => provider?.token === token)?.ref;
      if (winner) break;
      current = current.parent ? injectors.get(current.parent.id) : undefined;
    }
    return { token, from, path, ...(winner ? { winner } : { error: `No observed provider for ${token}` }), flags: [], confidence: 'observed' };
  }

  private emitInstrumentation(context: RuntimeContext): void {
    const events = getInstrumentation(context.window)?.events ?? [];
    for (const event of events.slice(this.emittedInstrumentationEvents)) context.emit({
      domain: domainForEvent(event.type), type: event.type, timestamp: event.timestamp,
      data: serialize(event.value ?? null, context.options.budget, event.source ?? '').value, confidence: 'instrumented', ...(event.source ? { cause: event.source } : {}),
    });
    this.emittedInstrumentationEvents = events.length;
  }
}

export const angularRuntimeAdapter = (): AngularRuntimeAdapter => new AngularRuntimeAdapter();

const detectVersion = (window: Window): string | undefined => (window as unknown as { ng?: { coreTokens?: { VERSION?: { full?: string } } } }).ng?.coreTokens?.VERSION?.full ?? window.document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? undefined;
const domainForEvent = (type: string): string => type === 'navigation' ? 'routing' : type.includes('form') ? 'forms' : type.includes('signal') || type.includes('store') || type.includes('ngrx') ? 'state' : type.includes('profile') || type.includes('change-detection') ? 'performance' : 'application';
