const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ── CONFIGURACIÓN ──────────────────────────────────────────
const SHEET_ID = '1SXNpF6OQpcYTZ0r8RkfG2NKFtSCbisU3oiwerJ0JWWc';
const SHEET_NAME = 'Pedidos';

// Credenciales de la cuenta de servicio
// IMPORTANTE: reemplazá con tu nuevo JSON después de regenerar la clave
const CREDENTIALS = {
  type: "service_account",
  project_id: "sinuous-client-491800-t6",
  private_key_id: "TU_NUEVO_PRIVATE_KEY_ID",
  private_key: "TU_NUEVA_PRIVATE_KEY",
  client_email: "caresse-bot@sinuous-client-491800-t6.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
};

// ── AUTH GOOGLE ────────────────────────────────────────────
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// ── INICIALIZAR ENCABEZADOS SI LA HOJA ESTÁ VACÍA ─────────
async function inicializarHoja(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:J1`,
  });
  const filas = res.data.values;
  if (!filas || filas.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'N° Orden', 'Fecha', 'Cliente', 'Envío',
          'Código', 'Producto', 'Unidades', 'Precio x Bulto', 'Total Línea', 'Total Pedido'
        ]]
      }
    });
  }
}

// ── ENDPOINT: GUARDAR PEDIDO ───────────────────────────────
app.post('/pedido', async (req, res) => {
  try {
    const { ordenNumero, fecha, cliente, envio, items, total } = req.body;

    const sheets = await getSheets();
    await inicializarHoja(sheets);

    // Cada item del pedido es una fila
    const filas = items.map((item, i) => [
      i === 0 ? ordenNumero : '',   // N° orden solo en primera fila
      i === 0 ? fecha : '',          // Fecha solo en primera fila
      i === 0 ? cliente : '',        // Cliente solo en primera fila
      i === 0 ? envio : '',          // Envío solo en primera fila
      item.codigo,
      item.producto,
      item.unidades,
      item.precioUnitario,
      item.totalLinea,
      i === 0 ? total : '',          // Total solo en primera fila
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: filas }
    });

    res.json({ ok: true, orden: ordenNumero });
  } catch (err) {
    console.error('Error guardando pedido:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'Caresse Bot API corriendo ✅' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
