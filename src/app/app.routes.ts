import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { Docente } from './docente/docente';
import { Admin } from './admin/admin';
import { rolGuard } from './core/guards/rol.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'docente', component: Docente, canActivate: [rolGuard(['docente', 'admin'])] },
  { path: 'admin', component: Admin, canActivate: [rolGuard(['admin'])] },
];