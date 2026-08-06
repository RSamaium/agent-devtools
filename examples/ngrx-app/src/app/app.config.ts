import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideAgentDevtools } from '@adp-devtools/angular';
import { counterReducer } from './app';

export const appConfig: ApplicationConfig = { providers: [provideBrowserGlobalErrorListeners(), provideStore({ counter: counterReducer }), provideAgentDevtools()] };
