require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const XLSX = require('xlsx');

if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:4200' }));
app.use(express.json());

// Archivos en memoria, máximo 10 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

pool.connect()
    .then(() => console.log('Conexión exitosa a la base de datos PostgreSQL'))
    .catch(err => console.error('Error al conectar a la base de datos:', err));

// Almacén en memoria por carga (no se persiste en PostgreSQL)
let listasPorGrupo = new Map();

// ---------- Funciones auxiliares ----------

function normalizarClaveGrupo(valor) {
    return String(valor ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

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

// Extrae y agrupa alumnos por clave de grupo desde el libro de Excel en memoria
function extraerListasPorGrupo(libro) {
    const mapaAlumnos = new Map();

    // 1. Mapa de carrera por matrícula desde PIUTTEC
    const carreraPorMatricula = new Map();
    const hojaPiuttec = libro.Sheets['PIUTTEC'];
    if (hojaPiuttec) {
        const filasPiuttec = XLSX.utils.sheet_to_json(hojaPiuttec, { header: 1, defval: '' });
        let filaEncP = -1;
        let idxMatP = -1;
        let idxCarP = -1;

        for (let r = 0; r < Math.min(filasPiuttec.length, 10); r++) {
            const enc = filasPiuttec[r].map(h => String(h).trim().toUpperCase());
            const mIdx = enc.findIndex(h => h.includes('MATRICULA') || h.includes('MATRÍCULA'));
            const cIdx = enc.findIndex(h => h.includes('CARRERA'));
            if (mIdx >= 0) {
                filaEncP = r;
                idxMatP = mIdx;
                idxCarP = cIdx;
                break;
            }
        }

        if (filaEncP >= 0) {
            for (let i = filaEncP + 1; i < filasPiuttec.length; i++) {
                const f = filasPiuttec[i];
                const mat = idxMatP >= 0 ? String(f[idxMatP]).trim().replace(/\.0$/, '') : '';
                const carrera = idxCarP >= 0 ? String(f[idxCarP]).trim() : '';
                if (mat && carrera && !carreraPorMatricula.has(mat)) {
                    carreraPorMatricula.set(mat, carrera);
                }
            }
        }
    }

    // 2. Extraer alumnos desde LISTAS (detecta automáticamente la fila de encabezados)
    const hojaListas = libro.Sheets['LISTAS'];
    if (hojaListas) {
        const filasListas = XLSX.utils.sheet_to_json(hojaListas, { header: 1, defval: '' });
        let filaEnc = -1;
        let enc = [];

        for (let r = 0; r < Math.min(filasListas.length, 10); r++) {
            const cand = filasListas[r].map(h => String(h).trim().toUpperCase());
            const tieneMat = cand.some(h => h.includes('MATRICULA') || h.includes('MATRÍCULA'));
            const tieneNom = cand.some(h => h.includes('NOMBRE'));
            if (tieneMat && tieneNom) {
                filaEnc = r;
                enc = cand;
                break;
            }
        }

        if (filaEnc >= 0) {
            const idxGrupoRegular = enc.findIndex(h => h.startsWith('GRUPO CI ENEABR') || h.startsWith('GRUPO CI SEPDIC'));
            const idxGrupoRecurse = enc.findIndex(h => h === 'GRUPO CI');
            const idxDivision = enc.findIndex(h => h === 'DDD' || h.startsWith('DIVISION') || h.startsWith('DIVISIÓN'));
            const idxMatricula = enc.findIndex(h => h.includes('MATRICULA') || h.includes('MATRÍCULA'));
            const idxNombre = enc.findIndex(h => h.includes('NOMBRE') && (h.includes('ESTUDIANTE') || h.includes('ALUMNO'))) >= 0
                ? enc.findIndex(h => h.includes('NOMBRE') && (h.includes('ESTUDIANTE') || h.includes('ALUMNO')))
                : enc.findIndex(h => h.includes('NOMBRE'));
            const idxCarrera = enc.findIndex(h => h.includes('CARRERA'));

            for (let i = filaEnc + 1; i < filasListas.length; i++) {
                const fila = filasListas[i];
                const matricula = idxMatricula >= 0
                    ? String(fila[idxMatricula]).trim().replace(/\.0$/, '')
                    : '';
                const nombre = idxNombre >= 0 ? String(fila[idxNombre]).trim() : '';
                if (!matricula && !nombre) continue;

                const division = idxDivision >= 0 ? String(fila[idxDivision]).trim() : '';
                const carrera = (idxCarrera >= 0 ? String(fila[idxCarrera]).trim() : '')
                    || carreraPorMatricula.get(matricula)
                    || '';

                const clavesGrupo = new Set();
                if (idxGrupoRegular >= 0) {
                    const gReg = normalizarClaveGrupo(fila[idxGrupoRegular]);
                    if (gReg) clavesGrupo.add(gReg);
                }
                if (idxGrupoRecurse >= 0) {
                    const gRec = normalizarClaveGrupo(fila[idxGrupoRecurse]);
                    if (gRec) clavesGrupo.add(gRec);
                }

                for (const claveGrupo of clavesGrupo) {
                    if (!mapaAlumnos.has(claveGrupo)) {
                        mapaAlumnos.set(claveGrupo, []);
                    }
                    const lista = mapaAlumnos.get(claveGrupo);
                    const duplicado = lista.some(a => a.matricula === matricula && a.nombre === nombre);
                    if (!duplicado) {
                        lista.push({
                            nombre,
                            matricula,
                            division,
                            carrera
                        });
                    }
                }
            }
        }
    }

    for (const lista of mapaAlumnos.values()) {
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    }

    return mapaAlumnos;
}

function resumenListas(mapa) {
    let totalAlumnos = 0;
    for (const arr of mapa.values()) totalAlumnos += arr.length;
    return { grupos: mapa.size, totalAlumnos };
}

// ---------- Seguridad ----------

function verificarToken(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
    }
    next();
}

const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.' }
});

async function filtrarPorDocente(idUsuario, filas, forzarPropios = false) {
    const u = await pool.query('SELECT nombre_completo, rol FROM usuarios WHERE id = $1', [idUsuario]);
    if (u.rows.length === 0) return null;
    if (u.rows[0].rol === 'admin' && !forzarPropios) return filas;
    const mio = normalizar(u.rows[0].nombre_completo);
    return filas.filter(f => normalizar(f.docente) === mio);
}

// ---------- Usuarios ----------

app.post('/api/register', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { nombre_completo, numero_empleado, contrasena } = req.body;

        if (!nombre_completo || nombre_completo.trim().length < 3) {
            return res.status(400).json({ error: 'Por favor ingresa un nombre completo válido.' });
        }
        if (!numero_empleado || numero_empleado.trim() === '') {
            return res.status(400).json({ error: 'El número de empleado es obligatorio.' });
        }
        if (!contrasena || contrasena.length !== 4) {
            return res.status(400).json({ error: 'La contraseña debe ser de exactamente 4 caracteres.' });
        }

        const userExists = await pool.query('SELECT 1 FROM usuarios WHERE numero_empleado = $1', [numero_empleado]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'El número de empleado ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(contrasena.toUpperCase(), 10);

        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre_completo, numero_empleado, contrasena) VALUES ($1, $2, $3) RETURNING id, nombre_completo, numero_empleado, rol',
            [nombre_completo, numero_empleado, hashedPassword]
        );

        res.status(201).json({ mensaje: 'Usuario registrado exitosamente', usuario: nuevoUsuario.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor al registrar el usuario.' });
    }
});

app.post('/api/login', limitarLogin, async (req, res) => {
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

        const valida =
            (await bcrypt.compare(contrasena, usuario.contrasena)) ||
            (await bcrypt.compare(contrasena.toUpperCase(), usuario.contrasena));

        if (!valida) {
            return res.status(400).json({ error: 'Número de empleado o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
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

app.post('/upload', verificarToken, soloAdmin, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
        listasPorGrupo = extraerListasPorGrupo(libro);
        const infoListas = resumenListas(listasPorGrupo);
        console.log(`Listas en memoria: ${infoListas.grupos} grupos, ${infoListas.totalAlumnos} registros de alumnos.`);

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
                    promedio: isNaN(prom) ? null : prom
                };
            })
            .filter(g => g.grupo && g.docente)
            .filter((g, i, lista) =>
                i === lista.findIndex(x =>
                    x.grupo === g.grupo && x.docente === g.docente &&
                    x.horario === g.horario && x.asignatura === g.asignatura));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM grupos');

            const batchSize = 500;
            for (let i = 0; i < grupos.length; i += batchSize) {
                const lote = grupos.slice(i, i + batchSize);
                const placeholders = [];
                const params = [];
                let idx = 1;

                for (const g of lote) {
                    params.push(g.grupo, g.docente, g.horario, g.espacio, g.asignatura, g.promedio);
                    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
                }

                await client.query(
                    `INSERT INTO grupos (grupo, docente, horario, espacio, asignatura, promedio)
                     VALUES ${placeholders.join(', ')}`,
                    params
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

app.get('/datos', verificarToken, async (req, res) => {
    try {
        const soloMios = req.query.soloMios === '1';
        const todos = await pool.query('SELECT * FROM grupos ORDER BY grupo');
        const filas = await filtrarPorDocente(req.usuario.id, todos.rows, soloMios);
        if (filas === null) {
            return res.status(401).json({ error: 'Usuario no encontrado.' });
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

// Lista de alumnos por grupo desde memoria (disponible para docentes y admin)
app.get('/lista-grupo/:grupo', verificarToken, async (req, res) => {
    try {
        const claveGrupo = normalizarClaveGrupo(decodeURIComponent(req.params.grupo || ''));
        if (!claveGrupo) {
            return res.status(400).json({ error: 'Grupo no especificado.' });
        }

        const u = await pool.query('SELECT nombre_completo, rol FROM usuarios WHERE id = $1', [req.usuario.id]);
        if (u.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado.' });
        }

        if (u.rows[0].rol !== 'admin') {
            const mio = normalizar(u.rows[0].nombre_completo);
            const gRes = await pool.query('SELECT docente FROM grupos WHERE UPPER(TRIM(grupo)) = $1', [claveGrupo]);
            const rRes = await pool.query('SELECT docente FROM recurses WHERE UPPER(TRIM(grupo)) = $1', [claveGrupo]);
            const autorizados = [...gRes.rows, ...rRes.rows].map(x => normalizar(x.docente));
            if (!autorizados.includes(mio)) {
                return res.status(403).json({ error: 'No tienes permiso para consultar la lista de este grupo.' });
            }
        }

        const alumnos = listasPorGrupo.get(claveGrupo) || [];
        res.json({
            grupo: claveGrupo,
            total: alumnos.length,
            alumnos
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener la lista del grupo.' });
    }
});

// ---------- Excel de recurses ----------

app.post('/upload-recurses', verificarToken, soloAdmin, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo.' });
        }

        const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
        const hoja = libro.Sheets[libro.SheetNames[0]];

        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' }).slice(2);

        const mapa = new Map();
        for (const f of filas) {
            const docente = String(f[21]).trim();
            const grupo = String(f[18]).trim();
            const horario = String(f[17]).trim();
            const espacio = String(f[16]).trim();
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

            const batchSize = 500;
            for (let i = 0; i < recurses.length; i += batchSize) {
                const lote = recurses.slice(i, i + batchSize);
                const placeholders = [];
                const params = [];
                let idx = 1;

                for (const r of lote) {
                    params.push(r.docente, r.grupo, r.horario, r.espacio);
                    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
                }

                await client.query(
                    `INSERT INTO recurses (docente, grupo, horario, espacio)
                     VALUES ${placeholders.join(', ')}`,
                    params
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

app.get('/recurses', verificarToken, async (req, res) => {
    try {
        const soloMios = req.query.soloMios === '1';
        const todos = await pool.query('SELECT * FROM recurses ORDER BY docente, grupo');
        const filas = await filtrarPorDocente(req.usuario.id, todos.rows, soloMios);
        if (filas === null) {
            return res.status(401).json({ error: 'Usuario no encontrado.' });
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});