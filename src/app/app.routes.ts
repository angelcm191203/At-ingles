import { Routes } from '@angular/router';
import { Docente } from './docente/docente';
import { Admin } from './admin/admin';


export const routes: Routes = [{ path: '', redirectTo: 'login', pathMatch: 'full' },
     { path: 'Docente', component: Docente },
     { path: 'Admin', component: Admin },
];
