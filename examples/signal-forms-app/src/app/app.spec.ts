import { TestBed } from '@angular/core/testing';
import { provideAgentDevtools } from '@adp-devtools/angular';
import { App } from './app';

it('creates the Signal Forms fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
