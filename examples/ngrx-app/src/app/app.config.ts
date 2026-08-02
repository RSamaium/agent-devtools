import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { counterReducer } from './app';

export const appConfig: ApplicationConfig = { providers: [provideBrowserGlobalErrorListeners(), provideStore({ counter: counterReducer }), provideNgAgentDevtools()] };
