import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Se usa en las rutas: rolGuard(['admin']) deja pasar solo a esos roles
export function rolGuard(rolesPermitidos: string[]): CanActivateFn {
  return () => {
    const router = inject(Router);

    // El usuario se guardó en localStorage al iniciar sesión
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

    // Sin sesión: manda al login
    if (!usuario) {
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