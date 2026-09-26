import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface Alumno {
  nombre: string;
  materia: string;
  calificacion: number;
}

@Component({
  selector: 'app-docente',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './docente.html',
  styleUrl: './docente.css',
})
export class Docente implements OnInit {
  // Aquí guardamos los datos que llegan del backend
  alumnos: Alumno[] = [];

  // Mensaje de carga o error
  cargando: boolean = true;
  error: string = '';

  constructor(private http: HttpClient) {}

  // OnInit se ejecuta automáticamente en cuanto el componente se carga en pantalla
  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.http.get<Alumno[]>('http://localhost:3000/datos').subscribe({
      next: (datos) => {
        this.alumnos = datos;
        this.cargando = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'No se pudieron cargar los datos.';
        this.cargando = false;
      }
    });
  }
}