import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { provideAgentDevtools } from '@agent-devtools/angular';
import { App, counterReducer } from './app';

it('creates the NgRx fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideStore({ counter: counterReducer }), provideAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
