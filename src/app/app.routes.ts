import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { Docente } from './docente/docente';
import { Admin } from './admin/admin';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'docente', component: Docente },
  { path: 'admin', component: Admin },
];