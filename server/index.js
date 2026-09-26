const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt'); // metodo de incriptacion de contraseñas 

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// conexion a BD
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'At-ingles',
    password: 'root', // contraseña bd
    port: 5432,
});

// Probar conexión
pool.connect()
    .then(() => console.log('Conexión exitosa a la base de datos PostgreSQL: At-ingles'))
    .catch(err => console.error('Error al conectar a la base de datos:', err));

// Registros de usuarios 
app.post('/api/register', async (req, res) => {
    try {
        const { nombre_completo, numero_empleado, contrasena } = req.body;

        // 1. Validar que el nombre no esté vacío o sea muy corto (mínimo 3 caracteres)
        if (!nombre_completo || nombre_completo.trim().length < 3) {
            return res.status(400).json({ error: 'Por favor ingresa tu nombre completo válido.' });
        }

        // 2. Validar número de empleado
        if (!numero_empleado || numero_empleado.trim() === '') {
            return res.status(400).json({ error: 'El número de empleado es obligatorio.' });
        }

        // 3. Validar que la contraseña sea exactamente de 4 caracteres (CURP)
        if (!contrasena || contrasena.length !== 4) {
            return res.status(400).json({ error: 'La contraseña debe ser de exactamente 4 caracteres (primeras letras de tu CURP).' });
        }

        // Verificacion de número de empleado existente antes de registrar
        const userExists = await pool.query('SELECT * FROM usuarios WHERE numero_empleado = $1', [numero_empleado]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El número de empleado ya está registrado.' });
        }

        // Encriptacion de contraseña 
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        // Guardar el nuevo usuario en la base de datos
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre_completo, numero_empleado, contrasena) VALUES ($1, $2, $3) RETURNING id, nombre_completo, numero_empleado',
            [nombre_completo, numero_empleado, hashedPassword]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente',
            usuario: nuevoUsuario.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al registrar el usuario.' });
    }
});

// Inicio de sesion 
app.post('/api/login', async (req, res) => {
    try {
        const { numero_empleado, contrasena } = req.body;

        if (!numero_empleado || !contrasena) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        // Buscar al usuario por su número de empleado
        const resultado = await pool.query('SELECT * FROM usuarios WHERE numero_empleado = $1', [numero_empleado]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ error: 'Número de empleado o contraseña incorrectos.' });
        }

        const usuario = resultado.rows[0];

        // Validar la contraseña encriptada
        const contraseñaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Número de empleado o contraseña incorrectos.' });
        }

      res.json({
    mensaje: 'Inicio de sesión exitoso',
    usuario: {
        id: usuario.id,
        nombre_completo: usuario.nombre_completo,
        numero_empleado: usuario.numero_empleado
    }
});

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
    }
});

// Encender servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});