import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-docente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './docente.html',
  styleUrl: './docente.css',
})
export class Docente implements OnInit {
  alumnos: any[] = [];
  columnas: string[] = [];
  fechaActualizacion: string = '';
  cargando: boolean = true;
  error: string = '';

  constructor(
    private http: HttpClient, 
    private router: Router,
    private cdr: ChangeDetectorRef // Inyectamos esto para forzar que la pantalla se actualice
  ) {}

  ngOnInit(): void {
    console.log('El componente Docente se ha inicializado correctamente.');
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.http.get<any>('http://localhost:3001/datos').subscribe({
      next: (respuesta) => {
        console.log('Datos recibidos del servidor:', respuesta);
        this.alumnos = respuesta.filas || [];
        this.fechaActualizacion = respuesta.fechaSubida || '';
        
        if (this.alumnos.length > 0) {
          this.columnas = Object.keys(this.alumnos[0]);
        }
        
        this.cargando = false;
        this.cdr.detectChanges(); // Forzamos la actualización visual de la pantalla
      },
      error: (err) => {
        console.error('Error al conectar con el puerto 3001:', err);
        this.error = 'No se pudieron cargar los datos del servidor.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarSesion(): void {
    this.router.navigate(['/login']);
  }
}