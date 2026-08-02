import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideNgAgentDevtools } from '@ng-agent/angular';

export const appConfig: ApplicationConfig = { providers: [provideBrowserGlobalErrorListeners(), provideNgAgentDevtools({ redact: ['account.password', 'account.confirmPassword'], signalForms: { captureSchemas: true, captureValidationEvents: true, captureSubmissions: true } })] };
