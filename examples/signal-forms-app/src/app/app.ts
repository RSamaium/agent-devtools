import { Component, signal } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { instrumentSignalForm } from '@ng-agent/angular';

@Component({ selector: 'app-root', imports: [FormField], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  protected readonly model = signal({ password: '', confirmPassword: '' });
  protected readonly accountForm = form(this.model, path => {
    required(path.password, { message: 'Password is required' });
    validate(path.confirmPassword, ({ value, valueOf }) => value() === valueOf(path.password) ? undefined : { kind: 'passwordMismatch', message: 'Passwords must match' });
  });
  private readonly unregisterForm = instrumentSignalForm('account', this.accountForm, {
    owner: this, model: this.model, schema: { name: 'accountSchema', crossField: ['password', 'confirmPassword'] },
    fields: [
      { path: 'account.password', field: this.accountForm.password },
      { path: 'account.confirmPassword', field: this.accountForm.confirmPassword },
    ],
  });
}
