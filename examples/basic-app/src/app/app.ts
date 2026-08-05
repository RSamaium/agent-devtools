import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { Router, RouterOutlet } from '@angular/router';
import { instrumentRouter, instrumentSignal, instrumentSignalForm, recordAgentDevtoolsEvent } from '@agent-devtools/angular';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormField],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('agent-devtools example');
  protected readonly accountModel = signal({ email: '', password: '' });
  protected readonly accountForm = form(this.accountModel, path => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email' });
    required(path.password, { message: 'Password is required' });
  });
  private readonly router = inject(Router);
  private readonly unregisterTitle = instrumentSignal('App.title', this.title, { owner: this });
  private readonly unregisterRouter = instrumentRouter(this.router);
  private readonly unregisterForm = instrumentSignalForm('account', this.accountForm, {
    owner: this,
    model: this.accountModel,
    fields: [
      { path: 'account.email', field: this.accountForm.email },
      { path: 'account.password', field: this.accountForm.password },
    ],
  });

  protected submit(): void {
    recordAgentDevtoolsEvent({ type: 'signal-form-submission', source: 'account', value: this.accountModel() });
  }
}
