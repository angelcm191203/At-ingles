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

// Regsitros de usuarios 
app.post('/api/register', async (req, res) => {
    try {
        const { nombre_completo, correo, contrasena } = req.body;

        // Verificacion de corredo existente antes de registrar un nuevo usuario
        const userExists = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        // Encriptacion de contraseña 
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        // Guardar el nuevo usuario en la base de datos
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre_completo, correo, contrasena) VALUES ($1, $2, $3) RETURNING id, nombre_completo, correo',
            [nombre_completo, correo, hashedPassword]
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
        const { correo, contrasena } = req.body;

        // Buscar al usuario por su correo
        const resultado = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
        }

        const usuario = resultado.rows[0];

        // Validar la contraseña encriptada
        const contraseñaValida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
        }

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            usuario: {
                id: usuario.id,
                nombre_completo: usuario.nombre_completo,
                correo: usuario.correo
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