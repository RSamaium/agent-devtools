import type { Routes } from '@angular/router';
import { ConfirmationPage } from './app';
export const routes: Routes = [{ path: 'confirmation', component: ConfirmationPage, data: { flow: 'checkout' } }];
