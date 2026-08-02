import { installRuntimeBridge } from '@ng-agent/runtime';
import { componentsAdapter } from '@ng-agent/adapter-components';
import { routerAdapter } from '@ng-agent/adapter-router';
import { diAdapter } from '@ng-agent/adapter-di';
import { signalsAdapter } from '@ng-agent/adapter-signals';
import { formsAdapter } from '@ng-agent/adapter-forms';
import { signalFormsAdapter } from '@ng-agent/adapter-signal-forms';
import { ngrxStoreAdapter } from '@ng-agent/adapter-ngrx-store';
import { ngrxSignalStoreAdapter } from '@ng-agent/adapter-ngrx-signal-store';
import { profilerAdapter } from '@ng-agent/adapter-profiler';

if (typeof window !== 'undefined' && !window.__NG_AGENT__) {
  installRuntimeBridge(window, { adapters: [componentsAdapter(), routerAdapter(), diAdapter(), signalsAdapter(), formsAdapter(), signalFormsAdapter(), ngrxStoreAdapter(), ngrxSignalStoreAdapter(), profilerAdapter()] });
}
