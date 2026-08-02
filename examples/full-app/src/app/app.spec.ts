import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { App, CHECKOUT_API } from './app';
import { routes } from './app.routes';

it('creates the full fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), { provide: CHECKOUT_API, useValue: '/checkout' }, provideNgAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
