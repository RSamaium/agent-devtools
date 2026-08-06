import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideAgentDevtools } from '@adp-devtools/angular';

export const appConfig: ApplicationConfig = { providers: [provideBrowserGlobalErrorListeners(), provideAgentDevtools({ redact: ['account.password', 'account.confirmPassword'], signalForms: { captureSchemas: true, captureValidationEvents: true, captureSubmissions: true } })] };
