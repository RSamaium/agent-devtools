import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAgentDevtools } from '@adp-devtools/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAgentDevtools({
      redact: ['account.password'],
      historyLimit: 100,
      signalForms: { captureSchemas: true, captureValidationEvents: true, captureSubmissions: true },
    })
  ]
};
