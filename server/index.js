const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;
console.log('>>> index.js de server con recurses <<<');

app.use(cors());
app.use(express.json());

// multer guarda el archivo en memoria (no en disco)
const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'At-ingles',
    password: 'root',
    port: 5432,
});

pool.connect()
    .then(() => console.log('Conexión exitosa a la base de datos PostgreSQL: At-ingles'))
    .catch(err => console.error('Error al conectar a la base de datos:', err));

// ---------- Funciones auxiliares ----------

// Busca el valor de una columna cuyo encabezado EMPIECE con cierto texto
function col(fila, inicio) {
    const clave = Object.keys(fila).find(k => k.trim().toUpperCase().startsWith(inicio));
    return clave ? fila[clave] : '';
}

// Quita título, acentos y ordena las palabras para comparar nombres
function normalizar(nombre) {
    return String(nombre)
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(LIC|LICDA|ING|MTRO|MTRA|DR|DRA|L\.?C\.?)\b\.?/g, '')
        .split(/\s+/).filter(Boolean).sort().join(' ');
}

// ---------- Usuarios ----------

app.post('/api/register', async (req, res) => {
    try {
        const { nombre_completo, numero_empleado, contrasena } = req.body;

        if (!nombre_completo || nombre_completo.trim().length < 3) {
            return res.status(400).json({ error: 'Por favor ingresa tu nombre completo válido.' });
        }
        if (!numero_empleado || numero_empleado.trim() === '') {
            return res.status(400).json({ error: 'El número de empleado es obligatorio.' });
        }
        if (!contrasena || contrasena.length !== 4) {
            return res.status(400).json({ error: 'La contraseña debe ser de exactamente 4 caracteres (primeras letras de tu CURP).' });
        }

        const userExists = await pool.query('SELECT * FROM usuarios WHERE numero_empleado = $1', [numero_empleado]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El número de empleado ya está registrado.' });
        }

        // La contraseña se guarda en mayúsculas, igual que las del script de docentes
        const hashedPassword = await bcrypt.hash(contrasena.toUpperCase(), 10);

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

app.post('/api/login', async (req, res) => {
    try {
        const { numero_empleado, contrasena } = req.body;

        if (!numero_empleado || !contrasena) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        const resultado = await pool.query('SELECT * FROM usuarios WHERE numero_empleado = $1', [numero_empleado]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ error: 'Número de empleado o contraseña incorrectos.' });
        }

        const usuario = resultado.rows[0];

        // Acepta la contraseña tal cual o en mayúsculas
        const valida =
            (await bcrypt.compare(contrasena, usuario.contrasena)) ||
            (await bcrypt.compare(contrasena.toUpperCase(), usuario.contrasena));

        if (!valida) {
            return res.status(400).json({ error: 'Número de empleado o contraseña incorrectos.' });
        }

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            usuario: {
                id: usuario.id,
                nombre_completo: usuario.nombre_completo,
                numero_empleado: usuario.numero_empleado,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al iniciar sesión.' });
    }
});

// ---------- Excel de grupos ----------

app.post('/upload-recurses', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = libro.Sheets[libro.SheetNames[0]];

        // header: 1 -> filas como arreglos (se leen por POSICIÓN, porque el Excel
        // repite encabezados como "GRUPO CI"). Las filas 1 y 2 son encabezados.
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' }).slice(2);

        // Una fila por cada docente + grupo + horario (sin repetir)
        const mapa = new Map();
        for (const f of filas) {
            const docente = String(f[21]).trim();   // PROFESOR DE RECURSE PRESENCIAL
            const grupo = String(f[18]).trim();     // segundo "GRUPO CI"
            const horario = String(f[17]).trim();   // HORARIO
            const espacio = String(f[16]).trim();   // ESPACIO EDUCATIVO
            if (!docente || !grupo) continue;

            const clave = `${docente}|${grupo}|${horario}`;
            if (!mapa.has(clave)) {
                mapa.set(clave, { docente, grupo, horario, espacio });
            }
        }
        const recurses = [...mapa.values()];

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM recurses');
            for (const r of recurses) {
                await client.query(
                    `INSERT INTO recurses (docente, grupo, horario, espacio)
                     VALUES ($1,$2,$3,$4)`,
                    [r.docente, r.grupo, r.horario, r.espacio]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ mensaje: 'Recurses subidos correctamente', filas: recurses.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar el archivo.' });
    }
});

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

// ---------- Excel de recurses ----------

app.post('/upload-recurses', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = libro.Sheets[libro.SheetNames[0]];

        // header: 1 -> filas como arreglos (se leen por POSICIÓN, porque el Excel
        // repite encabezados como "GRUPO CI"). Las filas 1 y 2 son encabezados.
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' }).slice(2);

        // Junta los alumnos que comparten docente + grupo + horario
        const mapa = new Map();
        for (const f of filas) {
            const docente = String(f[21]).trim();   // PROFESOR DE RECURSE PRESENCIAL
            const grupo = String(f[18]).trim();     // segundo "GRUPO CI"
            const horario = String(f[17]).trim();   // HORARIO
            const espacio = String(f[16]).trim();   // ESPACIO EDUCATIVO
            if (!docente || !grupo) continue;

            const clave = `${docente}|${grupo}|${horario}`;
            if (mapa.has(clave)) mapa.get(clave).alumnos++;
            else mapa.set(clave, { docente, grupo, horario, espacio, alumnos: 1 });
        }
        const recurses = [...mapa.values()];

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM recurses');
            for (const r of recurses) {
                await client.query(
                    `INSERT INTO recurses (docente, grupo, horario, espacio, alumnos)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [r.docente, r.grupo, r.horario, r.espacio, r.alumnos]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ mensaje: 'Recurses subidos correctamente', filas: recurses.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar el archivo.' });
    }
});

app.get('/recurses', async (req, res) => {
    try {
        const { numero_empleado } = req.query;
        const todos = await pool.query('SELECT * FROM recurses ORDER BY docente, grupo');
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
                filas = filas.filter(r => normalizar(r.docente) === mio);
            }
        }

        res.json({
            filas: filas.map(({ id, fecha_subida, ...resto }) => resto),
            fechaSubida: todos.rows.length ? todos.rows[0].fecha_subida : ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar los recurses.' });
    }
});

// Encender servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});