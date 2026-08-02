import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { App, counterReducer } from './app';

it('creates the NgRx fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideStore({ counter: counterReducer }), provideNgAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
