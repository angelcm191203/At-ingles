const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');

// ===== AJUSTA SOLO ESTO =====
const CONFIG = {
    archivo: 'USUARIOS CI.xlsx',
     hoja: null,
    colNombre: 'NOMBRE',
    colNumero: 'ID',            // el número de empleado
    colCurp: 'USUARIO',         // las 4 letras que serán la contraseña
   soloProbar: false         // true = solo muestra qué haría, NO guarda nada
};
// ============================

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'At-ingles',
    password: 'root',
    port: 5432,
});

function col(fila, inicio) {
    const clave = Object.keys(fila).find(k => k.trim().toUpperCase().startsWith(inicio));
    return clave ? fila[clave] : '';
}

async function importar() {
    const libro = XLSX.readFile(CONFIG.archivo);
    const nombreHoja = CONFIG.hoja || libro.SheetNames[0];
    const hoja = libro.Sheets[nombreHoja];
    if (!hoja) {
        console.log('No existe la hoja:', nombreHoja, '| Hojas disponibles:', libro.SheetNames);
        return pool.end();
    }

    const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
    console.log(`Hoja "${nombreHoja}": ${filas.length} filas. Columnas:`, Object.keys(filas[0] || {}));

    let creados = 0, omitidos = 0;

    for (const fila of filas) {
        const nombre = String(col(fila, CONFIG.colNombre)).trim();
        const numero = String(col(fila, CONFIG.colNumero)).trim();
        const curp = String(col(fila, CONFIG.colCurp)).trim().toUpperCase();

        if (nombre.length < 3 || !numero || !/^[A-Z]{4}$/.test(curp)) {
            console.log('Omitido (datos incompletos):', nombre || '(sin nombre)');
            omitidos++;
            continue;
        }

        if (CONFIG.soloProbar) {
            console.log('Crearía:', nombre, '| empleado', numero, '| contraseña', curp.substring(0, 4));
            creados++;
            continue;
        }

        // Contraseña = 4 primeras letras de la CURP, cifrada. La CURP no se guarda.
        const hash = await bcrypt.hash(curp.substring(0, 4), 10);
        const r = await pool.query(
            `INSERT INTO usuarios (nombre_completo, numero_empleado, contrasena, rol)
             VALUES ($1, $2, $3, 'docente')
             ON CONFLICT (numero_empleado) DO NOTHING`,
            [nombre, numero, hash]
        );
        if (r.rowCount === 1) creados++; else omitidos++;
    }

    console.log(`\nListo: ${creados} ${CONFIG.soloProbar ? 'se crearían' : 'cuentas creadas'}, ${omitidos} omitidas.`);
    await pool.end();
}

importar().catch(err => { console.error('Error:', err); pool.end(); });