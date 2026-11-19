import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface Grupo {
  grupo: string;
  docente: string;
  horario: string;
  espacio: string;
  asignatura: string;
  promedio: number | null;
}

interface Recurse {
  docente: string;
  grupo: string;
  horario: string;
  espacio: string;
}

interface PestanaCuatri {
  numero: number;
  grupos: Grupo[];
}

@Component({
  selector: 'app-docente',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './docente.html',
  styleUrl: './docente.css',
})
export class Docente implements OnInit {
  // Cuatrimestres que se muestran (6 y 11 son estadías y no entran)
  private readonly CUATRIS = [1, 2, 3, 4, 5, 7, 8, 9, 10];

  grupos: Grupo[] = [];
  recurses: Recurse[] = [];
  pestanasCuatri: PestanaCuatri[] = [];
  pestana: number | 'recurses' = 1;   // pestaña seleccionada

  fechaActualizacion: string = '';
  cargando: boolean = true;
  error: string = '';
  errorRecurses: string = '';

  usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  esAdmin: boolean = this.usuario.rol === 'admin';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarRecurses();
  }

  // "10IN24" -> 10, "2IN2" -> 2, "RECURSE INGLÉS I" -> null
  private cuatriDe(grupo: string): number | null {
    const m = /^(\d+)/.exec(String(grupo).trim());
    return m ? Number(m[1]) : null;
  }

  private limpiarTexto(v: any): string {
    return String(v ?? '').trim().replace(/\s+/g, ' ');
  }

  private deduplicarGrupos(lista: Grupo[]): Grupo[] {
    const vistos = new Set<string>();
    const unicos: Grupo[] = [];

    for (const g of lista) {
      const grupo = this.limpiarTexto(g.grupo);
      const docente = this.limpiarTexto(g.docente);
      const horario = this.limpiarTexto(g.horario);
      const espacio = this.limpiarTexto(g.espacio);
      const asignatura = this.limpiarTexto(g.asignatura);
      const promNum = g.promedio !== null && g.promedio !== undefined && String(g.promedio) !== ''
        ? Number(g.promedio)
        : null;
      const promedio = promNum !== null && !Number.isNaN(promNum) ? promNum : null;

      const clave = [
        grupo.toUpperCase(),
        docente.toUpperCase(),
        asignatura.toUpperCase(),
        horario.toUpperCase(),
        espacio.toUpperCase(),
        promedio ?? ''
      ].join('|');

      if (!vistos.has(clave)) {
        vistos.add(clave);
        unicos.push({
          grupo,
          docente,
          horario,
          espacio,
          asignatura,
          promedio
        });
      }
    }

    return unicos.sort((a, b) => a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
  }

  private deduplicarRecurses(lista: Recurse[]): Recurse[] {
    const vistos = new Set<string>();
    const unicos: Recurse[] = [];

    for (const r of lista) {
      const docente = this.limpiarTexto(r.docente);
      const grupo = this.limpiarTexto(r.grupo);
      const horario = this.limpiarTexto(r.horario);
      const espacio = this.limpiarTexto(r.espacio);

      const clave = [
        docente.toUpperCase(),
        grupo.toUpperCase(),
        horario.toUpperCase(),
        espacio.toUpperCase()
      ].join('|');

      if (!vistos.has(clave)) {
        vistos.add(clave);
        unicos.push({ docente, grupo, horario, espacio });
      }
    }

    return unicos.sort((a, b) => a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
  }

  cargarDatos(): void {
    this.cargando = true;
    const soloMiosParam = this.esAdmin ? '&soloMios=1' : '';

    this.http.get<any>(
      `http://localhost:3000/datos?numero_empleado=${this.usuario.numero_empleado}${soloMiosParam}`
    ).subscribe({
      next: (respuesta) => {
        this.grupos = this.deduplicarGrupos(respuesta.filas || []);
        this.fechaActualizacion = respuesta.fechaSubida || '';

        this.pestanasCuatri = this.CUATRIS
          .map(n => ({ numero: n, grupos: this.grupos.filter(g => this.cuatriDe(g.grupo) === n) }))
          .filter(p => p.grupos.length > 0);

        this.cargando = false;
        this.ajustarPestana();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar los datos:', err);
        this.error = err.error?.error || 'No se pudieron cargar los datos del servidor.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarRecurses(): void {
    const soloMiosParam = this.esAdmin ? '&soloMios=1' : '';

    this.http.get<any>(
      `http://localhost:3000/recurses?numero_empleado=${this.usuario.numero_empleado}${soloMiosParam}`
    ).subscribe({
      next: (respuesta) => {
        this.recurses = this.deduplicarRecurses(respuesta.filas || []);
        if (!this.cargando) this.ajustarPestana();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar los recurses:', err);
        this.errorRecurses = err.error?.error || 'No se pudieron cargar los recurses.';
        this.cdr.detectChanges();
      }
    });
  }

  // Si la pestaña elegida no existe para este docente, se pasa a la primera con datos
  private ajustarPestana(): void {
    const hayCuatri = this.pestanasCuatri.some(p => p.numero === this.pestana);
    const hayRecurses = this.pestana === 'recurses' && this.recurses.length > 0;
    if (hayCuatri || hayRecurses) return;

    if (this.pestanasCuatri.length > 0) this.pestana = this.pestanasCuatri[0].numero;
    else if (this.recurses.length > 0) this.pestana = 'recurses';
  }

  get gruposActivos(): Grupo[] {
    return this.pestanasCuatri.find(p => p.numero === this.pestana)?.grupos ?? [];
  }

  get totalGrupos(): number {
    return this.pestanasCuatri.reduce((suma, p) => suma + p.grupos.length, 0);
  }

  get promedioGeneral(): number | null {
    const con = this.pestanasCuatri
      .flatMap(p => p.grupos)
      .filter(g => g.promedio !== null) as { promedio: number }[];
    if (con.length === 0) return null;
    return con.reduce((suma, g) => suma + g.promedio, 0) / con.length;
  }

  // Color del promedio
  claseProm(p: number | null): string {
    if (p === null) return 'sin';
    if (p >= 8) return 'alto';
    if (p >= 7) return 'medio';
    return 'bajo';
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.router.navigate(['/login']);
  }
}