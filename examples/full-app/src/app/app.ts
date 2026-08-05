import { Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { instrumentRouter, instrumentService, instrumentSignal, instrumentSignalForm, instrumentStore } from '@agent-devtools/angular';

export const CHECKOUT_API = new InjectionToken<string>('CHECKOUT_API');

@Component({ selector: 'app-confirmation', template: '<h2>Confirmation</h2>' })
export class ConfirmationPage {}

@Component({ selector: 'app-root', imports: [FormField, RouterLink, RouterOutlet], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  private readonly router = inject(Router);
  private readonly api = inject(CHECKOUT_API);
  protected readonly submitting = signal(false);
  private readonly cartCount = signal(1);
  private readonly cartTotal = computed(() => this.cartCount() * 25);
  protected readonly cart = { count: this.cartCount, total: this.cartTotal, add: () => this.cartCount.update(value => value + 1) };
  protected readonly model = signal({ email: '' });
  protected readonly checkoutForm = form(this.model, path => { required(path.email); email(path.email); });
  private readonly unregisterRouter = instrumentRouter(this.router, { owner: this });
  private readonly unregisterApi = instrumentService('CheckoutApi', { url: this.api }, { owner: this, metadata: { token: 'CHECKOUT_API' } });
  private readonly unregisterSubmitting = instrumentSignal('Checkout.submitting', this.submitting, { owner: this });
  private readonly unregisterCart = instrumentStore('CartStore', this.cart, 'signal-store');
  private readonly unregisterForm = instrumentSignalForm('checkout', this.checkoutForm, { owner: this, model: this.model, fields: [{ path: 'checkout.email', field: this.checkoutForm.email }] });
}
