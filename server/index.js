const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt'); // metodo de incriptacion de contraseñas
const multer = require('multer'); // recibe archivos subidos
const XLSX = require('xlsx');     // lee archivos Excel

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// multer guarda el archivo en memoria (no en disco)
const upload = multer({ storage: multer.memoryStorage() });

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

// ---------- Funciones auxiliares ----------

// Busca el valor de una columna cuyo encabezado EMPIECE con cierto texto
// (así no importa que el sufijo cambie de semestre: "GRUPO CI SEPDIC26", etc.)
function col(fila, inicio) {
    const clave = Object.keys(fila).find(k => k.trim().toUpperCase().startsWith(inicio));
    return clave ? fila[clave] : '';
}

// Quita título, acentos y ordena las palabras para comparar nombres:
// "LIC. ARCOS HERRERA ANA ISABEL" = "Ana Isabel Arcos Herrera"
function normalizar(nombre) {
    return String(nombre)
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(LIC|LICDA|ING|MTRO|MTRA|DR|DRA|L\.?C\.?)\b\.?/g, '')
        .split(/\s+/).filter(Boolean).sort().join(' ');
}

// ---------- Usuarios ----------

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

        // Guardar el nuevo usuario en la base de datos (el rol queda 'docente' por defecto)
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre_completo, numero_empleado, contrasena) VALUES ($1, $2, $3) RETURNING id, nombre_completo, numero_empleado, rol',
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
                numero_empleado: usuario.numero_empleado,
                rol: usuario.rol   // <-- faltaba esta línea
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
    }
});

// ---------- Excel de grupos ----------

// El admin sube el Excel
app.post('/upload', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = libro.Sheets['GRUPOS'];
        if (!hoja) {
            return res.status(400).json({ error: 'El Excel no tiene una hoja llamada GRUPOS.' });
        }

        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

        const grupos = filas
            .map(f => {
                const prom = parseFloat(col(f, 'PROMEDIO'));
                return {
                    grupo: String(col(f, 'GRUPO')).trim(),
                    docente: String(col(f, 'DOCENTE')).trim(),
                    horario: String(col(f, 'HORARIO')).trim(),
                    espacio: String(col(f, 'ESPACIO')).trim(),
                    asignatura: String(col(f, 'ASIGNATURA')).trim(),
                    promedio: isNaN(prom) ? null : prom   // #DIV/0! queda vacío
                };
            })
            .filter(g => g.grupo && g.docente);   // salta filas vacías

        // Reemplaza los datos anteriores por los nuevos (todo o nada)
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM grupos');
            for (const g of grupos) {
                await client.query(
                    `INSERT INTO grupos (grupo, docente, horario, espacio, asignatura, promedio)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [g.grupo, g.docente, g.horario, g.espacio, g.asignatura, g.promedio]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ mensaje: 'Archivo subido correctamente', filas: grupos.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar el archivo.' });
    }
});

// El docente consulta SUS grupos (el admin ve todos)
app.get('/datos', async (req, res) => {
    try {
        const { numero_empleado } = req.query;
        const todos = await pool.query('SELECT * FROM grupos ORDER BY grupo');
        let filas = todos.rows;

        if (numero_empleado) {
            const u = await pool.query(
                'SELECT nombre_completo, rol FROM usuarios WHERE numero_empleado = $1',
                [numero_empleado]
            );
            if (u.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }

            if (u.rows[0].rol !== 'admin') {
                const mio = normalizar(u.rows[0].nombre_completo);
                filas = filas.filter(g => normalizar(g.docente) === mio);
            }
        }

        res.json({
            filas: filas.map(({ id, fecha_subida, ...resto }) => resto),
            fechaSubida: todos.rows.length ? todos.rows[0].fecha_subida : ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar los datos.' });
    }
});

// Encender servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});