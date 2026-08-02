import { Component, Injectable, InjectionToken, inject } from '@angular/core';
import { instrumentService } from '@ng-agent/angular';

export const API_URL = new InjectionToken<string>('API_URL');

@Injectable({ providedIn: 'root' })
export class AuthService { readonly user = 'agent@example.test'; }

@Component({ selector: 'app-child', template: '<p>Child injector scope</p>', providers: [{ provide: API_URL, useValue: '/child-api' }] })
export class ChildComponent { readonly apiUrl = inject(API_URL); }

@Component({ selector: 'app-root', imports: [ChildComponent], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly apiUrl = inject(API_URL);
  private readonly unregisterAuth = instrumentService('AuthService', this.auth, { owner: this, metadata: { token: 'AuthService' } });
}
