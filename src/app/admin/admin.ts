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
  archivoSeleccionado: File | null = null;
  mensaje: string = '';

  constructor(private http: HttpClient, private router: Router) {}

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
      'http://localhost:3001/upload',
      formData
    ).subscribe({
      next: (respuesta) => {
        this.mensaje = `${respuesta.mensaje} (${respuesta.filas} filas)`;
      },
      error: (error) => {
        console.error(error);
        this.mensaje = 'Ocurrió un error al subir el archivo.';
      }
    });
  }

  cerrarSesion(): void {
    this.router.navigate(['/login']);
  }
}