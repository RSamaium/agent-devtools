import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideNgAgentDevtools } from '@ng-agent/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideNgAgentDevtools({
      redact: ['account.password'],
      historyLimit: 100,
      allowRuntimeMutations: false,
      signalForms: { captureSchemas: true, captureValidationEvents: true, captureSubmissions: true },
    })
  ]
};
