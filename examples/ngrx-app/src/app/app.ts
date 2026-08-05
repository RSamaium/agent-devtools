import { Component, inject } from '@angular/core';
import { Store, createAction, createReducer, on } from '@ngrx/store';
import { instrumentStore, recordAgentDevtoolsEvent } from '@agent-devtools/angular';

export interface AppState { counter: number }
export const increment = createAction('[Counter] Increment');
export const counterReducer = createReducer(0, on(increment, value => value + 1));

@Component({ selector: 'app-root', templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  private readonly store = inject(Store<AppState>);
  protected readonly count = this.store.selectSignal(state => state.counter);
  private readonly unregisterStore = instrumentStore('AppStore', this.store, 'ngrx', { state: () => ({ counter: this.count() }) });
  protected increment(): void {
    const action = increment(); this.store.dispatch(action);
    recordAgentDevtoolsEvent({ type: 'ngrx-action', source: 'AppStore', value: action });
  }
}
