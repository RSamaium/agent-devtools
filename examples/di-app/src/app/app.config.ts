import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, type ApplicationConfig } from '@angular/core';
import { provideAgentDevtools } from '@adp-devtools/angular';
import { API_URL } from './app';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection(), { provide: API_URL, useValue: '/api' }, provideAgentDevtools()],
};
