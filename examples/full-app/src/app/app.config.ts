import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { CHECKOUT_API } from './app';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = { providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), { provide: CHECKOUT_API, useValue: '/checkout' }, provideNgAgentDevtools({ redact: ['checkout.email'] })] };
