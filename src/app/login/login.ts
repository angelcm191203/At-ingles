import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { HttpClient } from '@angular/common/http'; 
import { Router } from '@angular/router';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  // true = Muestra Iniciar Sesión por defecto al arrancar la página
  isLoginMode: boolean = true;

  // Objetos para capturar los datos de los formularios actualizados
  registroData = {
    nombre_completo: '',
    numero_empleado: '',
    contrasena: ''
  };

  loginData = {
    numero_empleado: '',
    contrasena: ''
  };

  // Inyectamos HttpClient para comunicarnos con el servidor de Node.js
  constructor(private http: HttpClient, private router: Router) {}

  toggleMode(login: boolean) {
    this.isLoginMode = login;
  }

  // Función para registrar un nuevo usuario con validaciones estrictas
  onRegister() {
    // 1. Validar que el nombre no esté vacío o sea muy corto
    if (!this.registroData.nombre_completo || this.registroData.nombre_completo.trim().length < 3) {
      alert('⚠️ Por favor, completa tu nombre completo (mínimo 3 caracteres).');
      return;
    }

    // 2. Validar que el número de empleado contenga EXCLUSIVAMENTE números
    const soloNumeros = /^\d+$/;
    if (!this.registroData.numero_empleado || !soloNumeros.test(this.registroData.numero_empleado)) {
      alert('⚠️ El número de empleado debe contener únicamente números (sin letras ni símbolos).');
      return;
    }

    // 3. Validar que la contraseña tenga exactamente 4 caracteres y sean SOLO letras (CURP)
    const soloLetras = /^[A-Za-z]+$/;
    if (!this.registroData.contrasena || this.registroData.contrasena.length !== 4 || !soloLetras.test(this.registroData.contrasena)) {
      alert('⚠️ La contraseña debe ser de exactamente 4 letras (primeras letras de tu CURP, sin números ni símbolos).');
      return;
    }

    // Si pasa todas las validaciones, se envía la petición al servidor
    this.http.post('http://localhost:3000/api/register', this.registroData).subscribe({
      next: (response: any) => {
        alert('¡Usuario registrado con éxito!');
        console.log(response);
        this.isLoginMode = true; // Cambia automáticamente al panel de login
      },
      error: (err) => {
        alert(err.error.error || 'Ocurrió un error al registrarse');
      }
    });
  }

  // Función para iniciar sesión
 onLogin() {
  if (!this.loginData.numero_empleado || !this.loginData.contrasena) {
    alert('⚠️ Todos los campos son obligatorios para iniciar sesión.');
    return;
  }

  this.http.post('http://localhost:3000/api/login', this.loginData).subscribe({
    next: (response: any) => {
      alert('¡Bienvenido, ' + response.usuario.nombre_completo + '!');
      console.log(response);

      // Redirige a la interfaz de docente después del login exitoso
      this.router.navigate(['/docente']);
    },
    error: (err) => {
      alert(err.error.error || 'Credenciales incorrectas');
    }
  });
}
}