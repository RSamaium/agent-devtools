import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNgAgentDevtools } from '@ng-agent/angular';
import { API_URL, App } from './app';

it('creates the DI fixture', async () => {
  await TestBed.configureTestingModule({ imports: [App], providers: [provideZonelessChangeDetection(), { provide: API_URL, useValue: '/api' }, provideNgAgentDevtools()] }).compileComponents();
  expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
});
