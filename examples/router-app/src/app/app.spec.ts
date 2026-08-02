import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { App } from './app';
import { routes } from './app.routes';

it('creates the router fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), provideNgAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
