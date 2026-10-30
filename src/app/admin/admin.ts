import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  // Excel de grupos
  archivoSeleccionado: File | null = null;
  mensaje: string = '';

  // Excel de recurses (variables aparte para que no se mezclen)
  archivoRecurses: File | null = null;
  mensajeRecurses: string = '';

  constructor(private http: HttpClient, private router: Router) {}

  // ---------- Grupos ----------
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  subirExcel(): void {
    if (!this.archivoSeleccionado) {
      this.mensaje = 'Por favor selecciona un archivo primero.';
      return;
    }

    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);

    this.http.post<{ mensaje: string; filas: number }>(
      'http://localhost:3000/upload',
      formData
    ).subscribe({
      next: (respuesta) => {
        this.mensaje = `${respuesta.mensaje} (${respuesta.filas} filas)`;
      },
      error: (error) => {
        console.error(error);
        this.mensaje = error.error?.error || 'Ocurrió un error al subir el archivo.';
      }
    });
  }

  // ---------- Recurses ----------
  onRecursesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoRecurses = input.files[0];
    }
  }

  subirRecurses(): void {
    if (!this.archivoRecurses) {
      this.mensajeRecurses = 'Por favor selecciona un archivo primero.';
      return;
    }

    const formData = new FormData();
    formData.append('archivo', this.archivoRecurses);

    this.http.post<{ mensaje: string; filas: number }>(
      'http://localhost:3000/upload-recurses',
      formData
    ).subscribe({
      next: (respuesta) => {
        this.mensajeRecurses = `${respuesta.mensaje} (${respuesta.filas} filas)`;
      },
      error: (error) => {
        console.error(error);
        this.mensajeRecurses = error.error?.error || 'Ocurrió un error al subir el archivo.';
      }
    });
  }

  cerrarSesion(): void {
    localStorage.removeItem('usuario');
    this.router.navigate(['/login']);
  }
}