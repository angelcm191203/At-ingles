import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { HttpClient } from '@angular/common/http'; 

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  // false = Muestra Registro a la izquierda | true = Muestra Login a la derecha
  isLoginMode: boolean = false;

  // Objetos para capturar los datos de los formularios
  registroData = {
    nombre_completo: '',
    correo: '',
    contrasena: ''
  };

  loginData = {
    correo: '',
    contrasena: ''
  };

  // Inyectamos HttpClient para comunicarnos con el servidor de Node.js
  constructor(private http: HttpClient) {}

  toggleMode(login: boolean) {
    this.isLoginMode = login;
  }

  // Función para registrar un nuevo usuario en la base de datos
  onRegister() {
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
    this.http.post('http://localhost:3000/api/login', this.loginData).subscribe({
      next: (response: any) => {
        alert('¡Bienvenido, ' + response.usuario.nombre_completo + '!');
        console.log(response);
      },
      error: (err) => {
        alert(err.error.error || 'Credenciales incorrectas');
      }
    });
  }
}