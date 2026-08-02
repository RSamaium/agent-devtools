import { TestBed } from '@angular/core/testing';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { App } from './app';

it('creates the Signal Forms fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideNgAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
