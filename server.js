const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SHEET_ID = '1SXNpF6OQpcYTZ0r8RkfG2NKFtSCbisU3oiwerJ0JWWc';
const SHEET_NAME = 'Pedidos';

const CATALOGO = {
  cortinas: {
    label: "🚿 Cortinas y Protectores",
    tipos: [
      { nombre:"Cortina Venecita (90 mic)", variantes:[{cod:"5057",label:"Con ganchos — 8 colores",uxb:50,precio:3811.49}]},
      { nombre:"Cortina Plus (100 mic)", variantes:[{cod:"5032",label:"Blanca",uxb:50,precio:3096.34},{cod:"5033",label:"Cristal",uxb:50,precio:3096.34}]},
      { nombre:"Cortina Simple con ganchos", variantes:[{cod:"2009",label:"Motivos varios (75 mic)",uxb:70,precio:3037.57}]},
      { nombre:"Cortina Doble con ganchos", variantes:[{cod:"2010",label:"Impresa (75 mic + protector 40 mic)",uxb:50,precio:4095.00}]},
      { nombre:"Protector de cortina", esMicronaje:true, micronajes:[
        { label:"50 micrones", variantes:[{cod:"0026",label:"Blanco",uxb:100,precio:1938.53},{cod:"0027",label:"Traslúcido",uxb:100,precio:1938.53},{cod:"0028",label:"Beige",uxb:100,precio:1938.53}]},
        { label:"75 micrones", variantes:[{cod:"2013",label:"Blanco",uxb:80,precio:2352.74},{cod:"5250",label:"Celeste",uxb:80,precio:2352.74},{cod:"5267",label:"Rosa",uxb:80,precio:2352.74},{cod:"5205",label:"Beige",uxb:80,precio:2352.74},{cod:"5212",label:"Traslúcido",uxb:80,precio:2352.74}]},
        { label:"100 micrones", variantes:[{cod:"2011",label:"Blanco",uxb:60,precio:2926.67},{cod:"2012",label:"Traslúcido",uxb:60,precio:2926.67},{cod:"2015",label:"Beige",uxb:60,precio:2926.67}]}
      ]}
    ]
  },
  manteles: {
    label: "🍽️ Manteles",
    tipos: [
      { nombre:"Mantel Impreso Vinílico (90 mic)", variantes:[{cod:"2001",label:"1,40 × 1,80 mts",uxb:80,precio:2866.50},{cod:"2001-1",label:"1,40 × 2,20 mts",uxb:80,precio:3675.00}]},
      { nombre:"Mantel Ecocuero Clásic", variantes:[{cod:"2002",label:"1,40 × 1,80 mts",uxb:30,precio:4231.50},{cod:"2002-1",label:"1,40 × 2,20 mts",uxb:30,precio:5250.00}]},
      { nombre:"Mantel Ecocuero Premium", variantes:[{cod:"2004",label:"1,40 × 1,80 mts",uxb:24,precio:8610.00},{cod:"2004-1",label:"1,40 × 2,20 mts",uxb:24,precio:10290.00}]},
      { nombre:"Protector de Mantel (90 mic)", variantes:[{cod:"2003",label:"1,40 × 1,80 mts",uxb:80,precio:2457.00},{cod:"2003-1",label:"1,40 × 2,20 mts",uxb:80,precio:3150.00}]}
    ]
  },
  barrales: {
    label: "🔩 Barrales",
    tipos: [
      { nombre:"Barral Línea Lujo (1m a 2m)", variantes:[{cod:"1001",label:"Blanco",uxb:12,precio:8494.20},{cod:"1002",label:"Negro",uxb:12,precio:8494.20},{cod:"1005",label:"Aluminio",uxb:12,precio:7187.40},{cod:"1006",label:"Dorado",uxb:12,precio:9200.00},{cod:"1007",label:"Plateado",uxb:12,precio:9200.00}]},
      { nombre:"Barral Línea Chica (1m a 2m)", variantes:[{cod:"1003",label:"Natural aluminio",uxb:12,precio:5292.54},{cod:"1004",label:"Fino blanco/beige",uxb:12,precio:6403.32}]}
    ]
  },
  ganchos: {
    label: "🪝 Ganchos y Alfombras",
    tipos: [
      { nombre:"Ganchos Cadena", variantes:[{cod:"1101",label:"Blanco — docena",uxb:30,precio:400.00}]},
      { nombre:"Ganchos Fantasía", variantes:[{cod:"1102",label:"Oro / Plata / Peltre — docena",uxb:10,precio:4515.83},{cod:"1103",label:"Blanco / Beige / Nacar — docena",uxb:30,precio:1215.00}]},
      { nombre:"Alfombras de PVC", variantes:[{cod:"1201",label:"Rectangulares 32×53cm",uxb:12,precio:7252.74}]}
    ]
  }
};

const sesiones = {};
function getSesion(chatId) {
  if (!sesiones[chatId]) sesiones[chatId] = { estado:'inicio', nombre:'', pedido:[], categoriaActual:null, tipoActual:null, micronaje:null, prodActual:null, envio:'', ordenNumero:'' };
  return sesiones[chatId];
}
function resetSesion(chatId) { delete sesiones[chatId]; }

function fmt(n) { return "$ " + n.toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2}); }
function genOrden() { const d=new Date(); return "ORD-"+d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+"-"+String(Math.floor(Math.random()*9000)+1000); }

function telegramRequest(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({ hostname:'api.telegram.org', path:`/bot${TELEGRAM_TOKEN}/${method}`, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, res => {
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>resolve(JSON.parse(data)));
    });
    req.on('error',reject); req.write(body); req.end();
  });
}

function sendMessage(chatId, text, keyboard=null) {
  const params = { chat_id:chatId, text, parse_mode:'HTML' };
  if (keyboard) params.reply_markup = keyboard;
  return telegramRequest('sendMessage', params);
}

function makeKeyboard(botones, cols=2) {
  const rows=[];
  for(let i=0;i<botones.length;i+=cols) rows.push(botones.slice(i,i+cols).map(b=>({text:b})));
  return { keyboard:rows, resize_keyboard:true, one_time_keyboard:true };
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: { type:"service_account", project_id:"sinuous-client-491800-t6", private_key_id:process.env.PRIVATE_KEY_ID, private_key:process.env.PRIVATE_KEY.replace(/\\n/g,'\n'), client_email:"caresse-bot@sinuous-client-491800-t6.iam.gserviceaccount.com", token_uri:"https://oauth2.googleapis.com/token" },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version:'v4', auth: await auth.getClient() });
}

async function inicializarHoja(sheets) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId:SHEET_ID, range:`${SHEET_NAME}!A1:J1` });
  if (!res.data.values || res.data.values.length===0) {
    await sheets.spreadsheets.values.update({ spreadsheetId:SHEET_ID, range:`${SHEET_NAME}!A1`, valueInputOption:'RAW', requestBody:{ values:[['N° Orden','Fecha','Cliente','Envío','Código','Producto','Unidades','Precio x Bulto','Total Línea','Total Pedido']] }});
  }
}

async function guardarEnSheets(s) {
  try {
    const sheets = await getSheets();
    await inicializarHoja(sheets);
    const total = s.pedido.reduce((sum,p)=>sum+p.total,0);
    const fecha = new Date().toLocaleDateString("es-AR");
    const filas = s.pedido.map((p,i)=>[ i===0?s.ordenNumero:'', i===0?fecha:'', i===0?s.nombre:'', i===0?s.envio:'', p.prod.cod, p.prod._nombre+' — '+p.prod.label, p.bultos, p.prod.precio, p.total, i===0?total:'' ]);
    await sheets.spreadsheets.values.append({ spreadsheetId:SHEET_ID, range:`${SHEET_NAME}!A1`, valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{ values:filas }});
    console.log('✅ Pedido guardado:', s.ordenNumero);
  } catch(e) { console.error('❌ Error Sheets:', e.message); }
}

function armarResumenOrden(s) {
  const total = s.pedido.reduce((sum,p)=>sum+p.total,0);
  const fecha = new Date().toLocaleDateString("es-AR");
  let msg = `🧾 <b>ORDEN DE COMPRA — CARESSE</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📋 <b>N° Orden:</b> ${s.ordenNumero}\n📅 <b>Fecha:</b> ${fecha}\n👤 <b>Cliente:</b> ${s.nombre}\n🚚 <b>Envío:</b> ${s.envio}\n━━━━━━━━━━━━━━━━━━━━━\n`;
  s.pedido.forEach(p => { msg += `▪️ <b>${p.prod.cod}</b> — ${p.prod._nombre}\n   ${p.prod.label}\n   ${p.bultos} uds × ${fmt(p.prod.precio)} = <b>${fmt(p.total)}</b>\n`; });
  msg += `━━━━━━━━━━━━━━━━━━━━━\n💰 <b>TOTAL: ${fmt(total)}</b>\n━━━━━━━━━━━━━━━━━━━━━\n<i>* Precios por bulto (UxB) · No incluyen IVA</i>`;
  return msg;
}

async function procesarMensaje(chatId, texto) {
  const s = getSesion(chatId);
  if (texto === '/start') {
    resetSesion(chatId);
    await sendMessage(chatId, '👋 ¡Hola! Soy <b>Charlene</b>, de <b>Caresse</b>. 😊\n\nEstoy acá para ayudarte con tu pedido. ¿Me podés decir tu nombre?');
    getSesion(chatId).estado = 'esperando_nombre';
    return;
  }
  const CATS_BTN = ['🚿 Cortinas y Protectores','🍽️ Manteles','🔩 Barrales','🪝 Ganchos y Alfombras'];
  const CATS_MAP = { '🚿 Cortinas y Protectores':'cortinas','🍽️ Manteles':'manteles','🔩 Barrales':'barrales','🪝 Ganchos y Alfombras':'ganchos' };

  switch(s.estado) {
    case 'inicio':
    case 'esperando_nombre': {
      let nombre = texto.trim();
      const m = nombre.match(/(?:me llamo|soy|es|llamo)\s+([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+)/i);
      if(m) nombre=m[1]; else { const p=nombre.split(/\s+/); nombre=p[p.length-1]; }
      s.nombre = nombre.charAt(0).toUpperCase()+nombre.slice(1).toLowerCase();
      s.estado = 'eligiendo_categoria';
      await sendMessage(chatId, `¡Bienvenido/a, <b>${s.nombre}</b>! 🌟\n\n¿Qué categoría te interesa?`, makeKeyboard(CATS_BTN, 2));
      break;
    }
    case 'eligiendo_categoria': {
      const catKey = CATS_MAP[texto];
      if(!catKey){ await sendMessage(chatId,'Por favor elegí una categoría 😊', makeKeyboard(CATS_BTN,2)); return; }
      s.categoriaActual = catKey;
      s.estado = 'eligiendo_tipo';
      const tipos = CATALOGO[catKey].tipos.map(t=>t.nombre); tipos.push('⬅️ Volver');
      await sendMessage(chatId, `Elegí el producto de <b>${CATALOGO[catKey].label}</b>:`, makeKeyboard(tipos,1));
      break;
    }
    case 'eligiendo_tipo': {
      if(texto==='⬅️ Volver'){ s.estado='eligiendo_categoria'; await sendMessage(chatId,'¿Qué categoría?', makeKeyboard(CATS_BTN,2)); return; }
      const tipo = CATALOGO[s.categoriaActual].tipos.find(t=>t.nombre===texto);
      if(!tipo){ await sendMessage(chatId,'Elegí una opción 😊'); return; }
      s.tipoActual = tipo;
      if(tipo.esMicronaje){
        s.estado='eligiendo_micronaje';
        const mics=tipo.micronajes.map(m=>m.label); mics.push('⬅️ Volver');
        await sendMessage(chatId,'¿De cuántos micrones querés el protector?', makeKeyboard(mics,2));
      } else if(tipo.variantes.length===1){
        const v=tipo.variantes[0]; v._nombre=tipo.nombre; s.prodActual=v; s.estado='esperando_cantidad';
        await sendMessage(chatId,`Seleccionaste: <b>${v._nombre}</b>\n<i>${v.label}</i>\n\n💰 Precio por bulto: <b>${fmt(v.precio)}</b> (${v.uxb} unidades por bulto)\n\n¿Cuántas <b>unidades</b> querés?`);
      } else {
        s.estado='eligiendo_variante';
        const vars=tipo.variantes.map(v=>v.label); vars.push('⬅️ Volver');
        await sendMessage(chatId,`Seleccioná la variante de <b>${tipo.nombre}</b>:`, makeKeyboard(vars,2));
      }
      break;
    }
    case 'eligiendo_micronaje': {
      if(texto==='⬅️ Volver'){ s.estado='eligiendo_tipo'; const t=CATALOGO[s.categoriaActual].tipos.map(t=>t.nombre); t.push('⬅️ Volver'); await sendMessage(chatId,'Elegí el producto:', makeKeyboard(t,1)); return; }
      const mic=s.tipoActual.micronajes.find(m=>m.label===texto);
      if(!mic){ await sendMessage(chatId,'Elegí una opción 😊'); return; }
      s.micronaje=mic; s.estado='eligiendo_color';
      const cols=mic.variantes.map(v=>v.label); cols.push('⬅️ Volver');
      await sendMessage(chatId,`Protector <b>${mic.label}</b> — ¿qué color querés?`, makeKeyboard(cols,2));
      break;
    }
    case 'eligiendo_color': {
      if(texto==='⬅️ Volver'){ s.estado='eligiendo_micronaje'; const mics=s.tipoActual.micronajes.map(m=>m.label); mics.push('⬅️ Volver'); await sendMessage(chatId,'¿De cuántos micrones?', makeKeyboard(mics,2)); return; }
      const v=s.micronaje.variantes.find(v=>v.label===texto);
      if(!v){ await sendMessage(chatId,'Elegí un color 😊'); return; }
      v._nombre=`${s.tipoActual.nombre} ${s.micronaje.label}`; s.prodActual=v; s.estado='esperando_cantidad';
      await sendMessage(chatId,`Seleccionaste: <b>${v._nombre}</b>\n<i>${v.label}</i>\n\n💰 Precio por bulto: <b>${fmt(v.precio)}</b> (${v.uxb} unidades por bulto)\n\n¿Cuántas <b>unidades</b> querés?`);
      break;
    }
    case 'eligiendo_variante': {
      if(texto==='⬅️ Volver'){ s.estado='eligiendo_tipo'; const t=CATALOGO[s.categoriaActual].tipos.map(t=>t.nombre); t.push('⬅️ Volver'); await sendMessage(chatId,'Elegí el producto:', makeKeyboard(t,1)); return; }
      const v=s.tipoActual.variantes.find(v=>v.label===texto);
      if(!v){ await sendMessage(chatId,'Elegí una opción 😊'); return; }
      v._nombre=s.tipoActual.nombre; s.prodActual=v; s.estado='esperando_cantidad';
      await sendMessage(chatId,`Seleccionaste: <b>${v._nombre}</b>\n<i>${v.label}</i>\n\n💰 Precio por bulto: <b>${fmt(v.precio)}</b> (${v.uxb} unidades por bulto)\n\n¿Cuántas <b>unidades</b> querés?`);
      break;
    }
    case 'esperando_cantidad': {
      const n=parseInt(texto);
      if(isNaN(n)||n<1){ await sendMessage(chatId,'Por favor ingresá un número válido 😊'); return; }
      const total=n*s.prodActual.precio;
      s.pedido.push({prod:s.prodActual,bultos:n,total});
      s.estado='eligiendo_accion';
      await sendMessage(chatId,`✅ Agregado: <b>${n} unidad${n>1?"es":""}</b> de <i>${s.prodActual._nombre} — ${s.prodActual.label}</i>\nSubtotal: <b>${fmt(total)}</b>\n\n¿Querés agregar algo más?`, makeKeyboard(['➕ Agregar más productos','📋 Ver pedido','✅ Confirmar pedido'],2));
      break;
    }
    case 'eligiendo_accion': {
      if(texto==='➕ Agregar más productos'){ s.estado='eligiendo_categoria'; await sendMessage(chatId,'¿Qué categoría?', makeKeyboard(CATS_BTN,2)); }
      else if(texto==='📋 Ver pedido'){ await verPedido(chatId,s); }
      else if(texto==='✅ Confirmar pedido'){ await elegirEnvio(chatId,s); }
      else { await sendMessage(chatId,'Usá los botones 😊', makeKeyboard(['➕ Agregar más productos','📋 Ver pedido','✅ Confirmar pedido'],2)); }
      break;
    }
    case 'eligiendo_envio': {
      const envios=['📦 Correo Argentino','🚚 Andreani','🏪 Retiro en local'];
      if(!envios.includes(texto)){ await sendMessage(chatId,'¿Cómo preferís recibir tu pedido?', makeKeyboard(envios,1)); return; }
      s.envio=texto.replace(/^.\s/,'');
      s.ordenNumero=genOrden();
      await guardarEnSheets(s);
      await sendMessage(chatId, armarResumenOrden(s));
      await sendMessage(chatId,'¡Tu pedido fue generado con éxito! ✅\n\nUn asesor de <b>Caresse</b> se va a contactar con vos para confirmar el stock y coordinar la entrega 📦\n\n¡Gracias por elegirnos! 💙', makeKeyboard(['🛒 Hacer otro pedido'],1));
      s.estado='finalizado';
      break;
    }
    case 'finalizado': {
      if(texto==='🛒 Hacer otro pedido'){ resetSesion(chatId); getSesion(chatId).estado='esperando_nombre'; await sendMessage(chatId,'¡Empecemos de nuevo! 😊 ¿Me decís tu nombre?'); }
      else { await sendMessage(chatId,'¿Querés hacer otro pedido?', makeKeyboard(['🛒 Hacer otro pedido'],1)); }
      break;
    }
  }
}

async function verPedido(chatId,s) {
  if(s.pedido.length===0){ s.estado='eligiendo_categoria'; await sendMessage(chatId,'Todavía no agregaste nada 😊', makeKeyboard(['🚿 Cortinas y Protectores','🍽️ Manteles','🔩 Barrales','🪝 Ganchos y Alfombras'],2)); return; }
  const lines=s.pedido.map(p=>`• ${p.bultos}x <i>${p.prod._nombre} — ${p.prod.label}</i>\n  → ${fmt(p.total)}`).join('\n');
  const total=s.pedido.reduce((sum,p)=>sum+p.total,0);
  s.estado='eligiendo_accion';
  await sendMessage(chatId,`📋 <b>Tu pedido:</b>\n\n${lines}\n\n<b>Total: ${fmt(total)}</b>`, makeKeyboard(['➕ Agregar más','✅ Confirmar pedido'],2));
}

async function elegirEnvio(chatId,s) {
  if(s.pedido.length===0){ await sendMessage(chatId,'No tenés productos aún 😊'); return; }
  s.estado='eligiendo_envio';
  await sendMessage(chatId,'¿Cómo preferís recibir tu pedido?', makeKeyboard(['📦 Correo Argentino','🚚 Andreani','🏪 Retiro en local'],1));
}

app.post('/webhook', async (req,res) => {
  res.sendStatus(200);
  try {
    const update=req.body;
    if(!update.message) return;
    await procesarMensaje(update.message.chat.id, update.message.text||'');
  } catch(e){ console.error('Error webhook:',e.message); }
});

app.get('/set-webhook', async (req,res) => {
  const url=`https://${req.get('host')}/webhook`;
  const result=await telegramRequest('setWebhook',{url});
  res.json(result);
});

app.post('/pedido', async (req,res) => {
  try {
    const {ordenNumero,fecha,cliente,envio,items,total}=req.body;
    const sheets=await getSheets(); await inicializarHoja(sheets);
    const filas=items.map((item,i)=>[i===0?ordenNumero:'',i===0?fecha:'',i===0?cliente:'',i===0?envio:'',item.codigo,item.producto,item.unidades,item.precioUnitario,item.totalLinea,i===0?total:'']);
    await sheets.spreadsheets.values.append({spreadsheetId:SHEET_ID,range:`${SHEET_NAME}!A1`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:filas}});
    res.json({ok:true});
  } catch(e){ res.status(500).json({ok:false,error:e.message}); }
});

app.get('/',(req,res)=>res.json({status:'Caresse Bot corriendo ✅'}));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Servidor en puerto ${PORT}`));
