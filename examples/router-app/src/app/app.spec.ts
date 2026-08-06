import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAgentDevtools } from '@adp-devtools/angular';
import { App } from './app';
import { routes } from './app.routes';

it('creates the router fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), provideAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
