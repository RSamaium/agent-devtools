import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { instrumentRouter } from '@ng-agent/angular';

@Component({ selector: 'app-root', imports: [RouterLink, RouterOutlet], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  private readonly router = inject(Router);
  private readonly unregisterRouter = instrumentRouter(this.router);
}

@Component({ selector: 'app-home', template: '<h2>Home route</h2>' })
export class HomePage {}

@Component({ selector: 'app-checkout', template: '<h2>Checkout route</h2><p>Lazy route fixture</p>' })
export class CheckoutPage {}
