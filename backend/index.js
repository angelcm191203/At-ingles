const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Configuración de multer: guarda el archivo temporalmente en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Ruta donde vamos a guardar los datos ya procesados
const DATA_FILE = path.join(__dirname, 'data.json');

app.get('/', (req, res) => {
  res.send('Servidor backend funcionando 🚀');
});

// Endpoint para subir el Excel
app.post('/upload', upload.single('archivo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Leer el archivo Excel desde el buffer que nos dio multer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });

    // Tomamos la primera hoja del Excel
    const nombreHoja = workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];

    // Convertimos la hoja a un array de objetos JSON
    const datos = xlsx.utils.sheet_to_json(hoja);

    // Guardamos esos datos en data.json (esto reemplaza el archivo anterior)
    fs.writeFileSync(DATA_FILE, JSON.stringify(datos, null, 2));

    res.json({ mensaje: 'Excel procesado y guardado correctamente', filas: datos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

// Endpoint para consultar los datos guardados
app.get('/datos', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json([]); // si no hay datos aún, devolvemos vacío
  }
  const datos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(datos);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});