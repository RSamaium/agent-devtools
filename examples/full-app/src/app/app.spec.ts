import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAgentDevtools } from '@agent-devtools/angular';
import { App, CHECKOUT_API } from './app';
import { routes } from './app.routes';

it('creates the full fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), { provide: CHECKOUT_API, useValue: '/checkout' }, provideAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
