const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const DATA_FILE = path.join(__dirname, 'data.json');

app.get('/', (req, res) => {
  res.send('Servidor backend funcionando 🚀');
});

app.post('/upload', upload.single('archivo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    
    // Verificamos si existe la pestaña 'GRUPOS', si no, agarramos la primera por defecto
    const nombreHoja = workbook.SheetNames.includes('GRUPOS') ? 'GRUPOS' : workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];
    
    const datos = xlsx.utils.sheet_to_json(hoja);

    const contenidoGuardar = {
      fechaSubida: new Date().toLocaleString(),
      filas: datos
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(contenidoGuardar, null, 2));

    res.json({ mensaje: `Excel procesado correctamente desde la hoja '${nombreHoja}'`, filas: datos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

app.get('/datos', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ fechaSubida: null, filas: [] });
  }
  const contenido = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(contenido);
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});