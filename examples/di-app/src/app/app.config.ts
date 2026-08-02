import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, type ApplicationConfig } from '@angular/core';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { API_URL } from './app';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection(), { provide: API_URL, useValue: '/api' }, provideNgAgentDevtools()],
};
