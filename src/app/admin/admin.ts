import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin',
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  // Guardamos aquí el archivo que el usuario seleccione
  archivoSeleccionado: File | null = null;

  // Mensaje para mostrar el resultado al usuario
  mensaje: string = '';

  // Inyectamos HttpClient para poder hacer peticiones HTTP
  constructor(private http: HttpClient) {}

  // Se ejecuta cuando el usuario selecciona un archivo en el <input type="file">
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
    }
  }

  // Se ejecuta al hacer clic en el botón "Subir"
  subirExcel(): void {
    if (!this.archivoSeleccionado) {
      this.mensaje = 'Por favor selecciona un archivo primero.';
      return;
    }

    // FormData es necesario para enviar archivos por HTTP
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
        this.mensaje = 'Ocurrió un error al subir el archivo.';
      }
    });
  }
}