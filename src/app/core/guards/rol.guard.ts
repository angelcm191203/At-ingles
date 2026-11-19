import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Se usa en las rutas: rolGuard(['admin']) deja pasar solo a esos roles
export function rolGuard(rolesPermitidos: string[]): CanActivateFn {
  return () => {
    const router = inject(Router);

    const token = localStorage.getItem('token');
    let usuario: { rol?: string } | null = null;

    try {
      usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch {
      usuario = null;
    }

    // Sin sesión o sin token: limpia y manda al login
    if (!token || !usuario || !usuario.rol) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      router.navigate(['/login']);
      return false;
    }

    // Con sesión y rol permitido: deja pasar
    if (rolesPermitidos.includes(usuario.rol)) {
      return true;
    }

    // Con sesión pero sin permiso: lo regresa a su pantalla
    router.navigate([usuario.rol === 'admin' ? '/admin' : '/docente']);
    return false;
  };
}