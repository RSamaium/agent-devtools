import type { Routes } from '@angular/router';
import { CheckoutPage, HomePage } from './app';

export const routes: Routes = [
  { path: '', component: HomePage, data: { section: 'home' } },
  { path: 'checkout/:id', component: CheckoutPage, data: { section: 'checkout' } },
];
