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
 
const CAT_BTNS = [
  'Cortinas y Protectores',
  'Manteles',
  'Barrales',
  'Ganchos y Alfombras'
];
 
const CATALOGO = {
  'Cortinas y Protectores': {
    tipos: [
      { nombre:'Cortina Venecita (90 mic)', variantes:[{cod:'5057',label:'Con ganchos - 8 colores',uxb:50,precio:3811.49}]},
      { nombre:'Cortina Plus (100 mic)', variantes:[{cod:'5032',label:'Blanca',uxb:50,precio:3096.34},{cod:'5033',label:'Cristal',uxb:50,precio:3096.34}]},
      { nombre:'Cortina Simple con ganchos', variantes:[{cod:'2009',label:'Motivos varios (75 mic)',uxb:70,precio:3037.57}]},
      { nombre:'Cortina Doble con ganchos', variantes:[{cod:'2010',label:'Impresa (75 mic)',uxb:50,precio:4095.00}]},
      { nombre:'Protector de cortina', esMicronaje:true, micronajes:[
        { label:'50 micrones', variantes:[{cod:'0026',label:'Blanco',uxb:100,precio:1938.53},{cod:'0027',label:'Traslucido',uxb:100,precio:1938.53},{cod:'0028',label:'Beige',uxb:100,precio:1938.53}]},
        { label:'75 micrones', variantes:[{cod:'2013',label:'Blanco',uxb:80,precio:2352.74},{cod:'5250',label:'Celeste',uxb:80,precio:2352.74},{cod:'5267',label:'Rosa',uxb:80,precio:2352.74},{cod:'5205',label:'Beige',uxb:80,precio:2352.74},{cod:'5212',label:'Traslucido',uxb:80,precio:2352.74}]},
        { label:'100 micrones', variantes:[{cod:'2011',label:'Blanco',uxb:60,precio:2926.67},{cod:'2012',label:'Traslucido',uxb:60,precio:2926.67},{cod:'2015',label:'Beige',uxb:60,precio:2926.67}]}
      ]}
    ]
  },
  'Manteles': {
    tipos: [
      { nombre:'Mantel Impreso Vinilico (90 mic)', variantes:[{cod:'2001',label:'1.40 x 1.80 mts',uxb:80,precio:2866.50},{cod:'2001-1',label:'1.40 x 2.20 mts',uxb:80,precio:3675.00}]},
      { nombre:'Mantel Ecocuero Classic', variantes:[{cod:'2002',label:'1.40 x 1.80 mts',uxb:30,precio:4231.50},{cod:'2002-1',label:'1.40 x 2.20 mts',uxb:30,precio:5250.00}]},
      { nombre:'Mantel Ecocuero Premium', variantes:[{cod:'2004',label:'1.40 x 1.80 mts',uxb:24,precio:8610.00},{cod:'2004-1',label:'1.40 x 2.20 mts',uxb:24,precio:10290.00}]},
      { nombre:'Protector de Mantel (90 mic)', variantes:[{cod:'2003',label:'1.40 x 1.80 mts',uxb:80,precio:2457.00},{cod:'2003-1',label:'1.40 x 2.20 mts',uxb:80,precio:3150.00}]}
    ]
  },
  'Barrales': {
    tipos: [
      { nombre:'Barral Linea Lujo (1m a 2m)', variantes:[{cod:'1001',label:'Blanco',uxb:12,precio:8494.20},{cod:'1002',label:'Negro',uxb:12,precio:8494.20},{cod:'1005',label:'Aluminio',uxb:12,precio:7187.40},{cod:'1006',label:'Dorado',uxb:12,precio:9200.00},{cod:'1007',label:'Plateado',uxb:12,precio:9200.00}]},
      { nombre:'Barral Linea Chica (1m a 2m)', variantes:[{cod:'1003',label:'Natural aluminio',uxb:12,precio:5292.54},{cod:'1004',label:'Fino blanco/beige',uxb:12,precio:6403.32}]}
    ]
  },
  'Ganchos y Alfombras': {
    tipos: [
      { nombre:'Ganchos Cadena', variantes:[{cod:'1101',label:'Blanco - docena',uxb:30,precio:400.00}]},
      { nombre:'Ganchos Fantasia', variantes:[{cod:'1102',label:'Oro/Plata/Peltre - docena',uxb:10,precio:4515.83},{cod:'1103',label:'Blanco/Beige/Nacar - docena',uxb:30,precio:1215.00}]},
      { nombre:'Alfombras de PVC', variantes:[{cod:'1201',label:'Rectangulares 32x53cm',uxb:12,precio:7252.74}]}
    ]
  }
};
 
const sesiones = {};
function getSesion(id) {
  if (!sesiones[id]) sesiones[id] = {estado:'inicio',nombre:'',pedido:[],cat:null,tipo:null,mic:null,prod:null,envio:'',orden:''};
  return sesiones[id];
}
function resetSesion(id) { delete sesiones[id]; }
 
function fmt(n) { return '$ ' + n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function genOrden() { const d=new Date(); return 'ORD-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(Math.floor(Math.random()*9000)+1000); }
 
function tgReq(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname:'api.telegram.org',
      path:'/bot'+TELEGRAM_TOKEN+'/'+method,
      method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
    req.on('error',reject); req.write(body); req.end();
  });
}
 
function send(chatId, text, keyboard) {
  const p = {chat_id:chatId, text:text, parse_mode:'HTML'};
  if (keyboard) p.reply_markup = keyboard;
  return tgReq('sendMessage', p);
}
 
function mkKb(btns, cols) {
  cols = cols || 2;
  const rows = [];
  for (let i=0; i<btns.length; i+=cols) rows.push(btns.slice(i,i+cols).map(b=>({text:b})));
  return {keyboard:rows, resize_keyboard:true, one_time_keyboard:true};
}
 
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type:'service_account',
      project_id:'sinuous-client-491800-t6',
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: process.env.PRIVATE_KEY.replace(/\\n/g,'\n'),
      client_email:'caresse-bot@sinuous-client-491800-t6.iam.gserviceaccount.com',
      token_uri:'https://oauth2.googleapis.com/token'
    },
    scopes:['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({version:'v4', auth: await auth.getClient()});
}
 
async function inicializarHoja(sheets) {
  const res = await sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID, range:SHEET_NAME+'!A1:J1'});
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId:SHEET_ID, range:SHEET_NAME+'!A1', valueInputOption:'RAW',
      requestBody:{values:[['N Orden','Fecha','Cliente','Envio','Codigo','Producto','Unidades','Precio x Bulto','Total Linea','Total Pedido']]}
    });
  }
}
 
async function guardarSheets(s) {
  try {
    const sheets = await getSheets();
    await inicializarHoja(sheets);
    const total = s.pedido.reduce(function(sum,p){return sum+p.total;},0);
    const fecha = new Date().toLocaleDateString('es-AR');
    const filas = s.pedido.map(function(p,i) {
      return [
        i===0?s.orden:'', i===0?fecha:'', i===0?s.nombre:'', i===0?s.envio:'',
        p.prod.cod, p.prod._nombre+' - '+p.prod.label,
        p.bultos, p.prod.precio, p.total, i===0?total:''
      ];
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId:SHEET_ID, range:SHEET_NAME+'!A1',
      valueInputOption:'RAW', insertDataOption:'INSERT_ROWS',
      requestBody:{values:filas}
    });
    console.log('Pedido guardado:', s.orden);
  } catch(e) { console.error('Error Sheets:', e.message); }
}
 
function resumenOrden(s) {
  const total = s.pedido.reduce(function(sum,p){return sum+p.total;},0);
  const fecha = new Date().toLocaleDateString('es-AR');
  let msg = '<b>ORDEN DE COMPRA - CARESSE</b>\n';
  msg += '----------------------------\n';
  msg += '<b>N Orden:</b> '+s.orden+'\n';
  msg += '<b>Fecha:</b> '+fecha+'\n';
  msg += '<b>Cliente:</b> '+s.nombre+'\n';
  msg += '<b>Envio:</b> '+s.envio+'\n';
  msg += '----------------------------\n';
  s.pedido.forEach(function(p) {
    msg += '<b>'+p.prod.cod+'</b> - '+p.prod._nombre+'\n';
    msg += '   '+p.prod.label+'\n';
    msg += '   '+p.bultos+' uds x '+fmt(p.prod.precio)+' = <b>'+fmt(p.total)+'</b>\n';
  });
  msg += '----------------------------\n';
  msg += '<b>TOTAL: '+fmt(total)+'</b>\n';
  msg += '<i>Precios por bulto. No incluyen IVA.</i>';
  return msg;
}
 
async function procesar(chatId, texto) {
  const s = getSesion(chatId);
 
  if (texto === '/start') {
    resetSesion(chatId);
    await send(chatId, 'Hola! Soy <b>Charlene</b>, de <b>Caresse</b>.\n\nEstoy aca para ayudarte con tu pedido. Me podes decir tu nombre?');
    getSesion(chatId).estado = 'esperando_nombre';
    return;
  }
 
  if (s.estado === 'inicio' || s.estado === 'esperando_nombre') {
    let nombre = texto.trim();
    const m = nombre.match(/(?:me llamo|soy|es|llamo)\s+(\w+)/i);
    if (m) nombre = m[1];
    else { const p = nombre.split(/\s+/); nombre = p[p.length-1]; }
    s.nombre = nombre.charAt(0).toUpperCase()+nombre.slice(1).toLowerCase();
    s.estado = 'eligiendo_categoria';
    await send(chatId, 'Bienvenido/a, <b>'+s.nombre+'</b>!\n\nQue categoria te interesa?', mkKb(CAT_BTNS, 2));
    return;
  }
 
  if (s.estado === 'eligiendo_categoria') {
    if (!CATALOGO[texto]) {
      await send(chatId, 'Por favor elegi una categoria.', mkKb(CAT_BTNS, 2));
      return;
    }
    s.cat = texto;
    s.estado = 'eligiendo_tipo';
    const tipos = CATALOGO[texto].tipos.map(function(t){return t.nombre;});
    tipos.push('Volver');
    await send(chatId, 'Elegi el producto de <b>'+texto+'</b>:', mkKb(tipos, 1));
    return;
  }
 
  if (s.estado === 'eligiendo_tipo') {
    if (texto === 'Volver') {
      s.estado = 'eligiendo_categoria';
      await send(chatId, 'Que categoria te interesa?', mkKb(CAT_BTNS, 2));
      return;
    }
    const tipo = CATALOGO[s.cat].tipos.find(function(t){return t.nombre===texto;});
    if (!tipo) { await send(chatId, 'Elegi una opcion de la lista.'); return; }
    s.tipo = tipo;
    if (tipo.esMicronaje) {
      s.estado = 'eligiendo_micronaje';
      const mics = tipo.micronajes.map(function(m){return m.label;});
      mics.push('Volver');
      await send(chatId, 'De cuantos micrones queres el protector?', mkKb(mics, 2));
    } else if (tipo.variantes.length === 1) {
      const v = tipo.variantes[0];
      v._nombre = tipo.nombre;
      s.prod = v;
      s.estado = 'esperando_cantidad';
      await send(chatId, 'Seleccionaste: <b>'+v._nombre+'</b>\n'+v.label+'\n\nPrecio por bulto: <b>'+fmt(v.precio)+'</b> ('+v.uxb+' unidades por bulto)\n\nCuantas unidades queres?');
    } else {
      s.estado = 'eligiendo_variante';
      const vars = tipo.variantes.map(function(v){return v.label;});
      vars.push('Volver');
      await send(chatId, 'Selecciona la variante de <b>'+tipo.nombre+'</b>:', mkKb(vars, 2));
    }
    return;
  }
 
  if (s.estado === 'eligiendo_micronaje') {
    if (texto === 'Volver') {
      s.estado = 'eligiendo_tipo';
      const tipos = CATALOGO[s.cat].tipos.map(function(t){return t.nombre;});
      tipos.push('Volver');
      await send(chatId, 'Elegi el producto:', mkKb(tipos, 1));
      return;
    }
    const mic = s.tipo.micronajes.find(function(m){return m.label===texto;});
    if (!mic) { await send(chatId, 'Elegi una opcion.'); return; }
    s.mic = mic;
    s.estado = 'eligiendo_color';
    const cols = mic.variantes.map(function(v){return v.label;});
    cols.push('Volver');
    await send(chatId, 'Protector <b>'+mic.label+'</b> - que color queres?', mkKb(cols, 2));
    return;
  }
 
  if (s.estado === 'eligiendo_color') {
    if (texto === 'Volver') {
      s.estado = 'eligiendo_micronaje';
      const mics = s.tipo.micronajes.map(function(m){return m.label;});
      mics.push('Volver');
      await send(chatId, 'De cuantos micrones?', mkKb(mics, 2));
      return;
    }
    const v = s.mic.variantes.find(function(v){return v.label===texto;});
    if (!v) { await send(chatId, 'Elegi un color.'); return; }
    v._nombre = s.tipo.nombre+' '+s.mic.label;
    s.prod = v;
    s.estado = 'esperando_cantidad';
    await send(chatId, 'Seleccionaste: <b>'+v._nombre+'</b>\n'+v.label+'\n\nPrecio por bulto: <b>'+fmt(v.precio)+'</b> ('+v.uxb+' unidades por bulto)\n\nCuantas unidades queres?');
    return;
  }
 
  if (s.estado === 'eligiendo_variante') {
    if (texto === 'Volver') {
      s.estado = 'eligiendo_tipo';
      const tipos = CATALOGO[s.cat].tipos.map(function(t){return t.nombre;});
      tipos.push('Volver');
      await send(chatId, 'Elegi el producto:', mkKb(tipos, 1));
      return;
    }
    const v = s.tipo.variantes.find(function(v){return v.label===texto;});
    if (!v) { await send(chatId, 'Elegi una opcion.'); return; }
    v._nombre = s.tipo.nombre;
    s.prod = v;
    s.estado = 'esperando_cantidad';
    await send(chatId, 'Seleccionaste: <b>'+v._nombre+'</b>\n'+v.label+'\n\nPrecio por bulto: <b>'+fmt(v.precio)+'</b> ('+v.uxb+' unidades por bulto)\n\nCuantas unidades queres?');
    return;
  }
 
  if (s.estado === 'esperando_cantidad') {
    const n = parseInt(texto);
    if (isNaN(n) || n < 1) { await send(chatId, 'Por favor ingresa un numero valido mayor a 0.'); return; }
    const total = n * s.prod.precio;
    s.pedido.push({prod:s.prod, bultos:n, total:total});
    s.estado = 'eligiendo_accion';
    await send(chatId, 'Agregado: <b>'+n+' unidad'+(n>1?'es':'')+'</b> de '+s.prod._nombre+'\nSubtotal: <b>'+fmt(total)+'</b>\n\nQueres agregar algo mas?',
      mkKb(['Agregar mas productos','Ver pedido','Confirmar pedido'], 2));
    return;
  }
 
  if (s.estado === 'eligiendo_accion') {
    if (texto === 'Agregar mas productos') {
      s.estado = 'eligiendo_categoria';
      await send(chatId, 'Que categoria te interesa?', mkKb(CAT_BTNS, 2));
    } else if (texto === 'Ver pedido') {
      if (s.pedido.length === 0) {
        await send(chatId, 'No agregaste ningun producto todavia.', mkKb(CAT_BTNS, 2));
        s.estado = 'eligiendo_categoria';
        return;
      }
      const lines = s.pedido.map(function(p){return '- '+p.bultos+'x '+p.prod._nombre+' ('+p.prod.label+'): '+fmt(p.total);}).join('\n');
      const total = s.pedido.reduce(function(sum,p){return sum+p.total;},0);
      await send(chatId, '<b>Tu pedido:</b>\n\n'+lines+'\n\n<b>Total: '+fmt(total)+'</b>', mkKb(['Agregar mas','Confirmar pedido'], 2));
    } else if (texto === 'Confirmar pedido') {
      s.estado = 'eligiendo_envio';
      await send(chatId, 'Como preferis recibir tu pedido?', mkKb(['Correo Argentino','Andreani','Retiro en local'], 1));
    } else {
      await send(chatId, 'Usa los botones.', mkKb(['Agregar mas productos','Ver pedido','Confirmar pedido'], 2));
    }
    return;
  }
 
  if (s.estado === 'eligiendo_envio') {
    const envios = ['Correo Argentino','Andreani','Retiro en local'];
    if (!envios.includes(texto)) {
      await send(chatId, 'Elegi una opcion de envio.', mkKb(envios, 1));
      return;
    }
    s.envio = texto;
    s.orden = genOrden();
    await guardarSheets(s);
    await send(chatId, resumenOrden(s));
    await send(chatId, 'Tu pedido fue generado con exito!\n\nUn asesor de <b>Caresse</b> se va a contactar con vos para confirmar el stock y coordinar la entrega.\n\nGracias por elegirnos!',
      mkKb(['Hacer otro pedido'], 1));
    s.estado = 'finalizado';
    return;
  }
 
  if (s.estado === 'finalizado') {
    if (texto === 'Hacer otro pedido') {
      resetSesion(chatId);
      getSesion(chatId).estado = 'esperando_nombre';
      await send(chatId, 'Empecemos de nuevo! Me dices tu nombre?');
    } else {
      await send(chatId, 'Queres hacer otro pedido?', mkKb(['Hacer otro pedido'], 1));
    }
  }
}
 
app.post('/webhook', async function(req, res) {
  res.sendStatus(200);
  try {
    const update = req.body;
    if (!update.message) return;
    await procesar(update.message.chat.id, update.message.text || '');
  } catch(e) { console.error('Error:', e.message); }
});
 
app.get('/set-webhook', async function(req, res) {
  const url = 'https://'+req.get('host')+'/webhook';
  const result = await tgReq('setWebhook', {url:url});
  res.json(result);
});
 
app.post('/pedido', async function(req, res) {
  try {
    const b = req.body;
    const sheets = await getSheets();
    await inicializarHoja(sheets);
    const filas = b.items.map(function(item,i) {
      return [i===0?b.ordenNumero:'',i===0?b.fecha:'',i===0?b.cliente:'',i===0?b.envio:'',
        item.codigo,item.producto,item.unidades,item.precioUnitario,item.totalLinea,i===0?b.total:''];
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId:SHEET_ID, range:SHEET_NAME+'!A1',
      valueInputOption:'RAW', insertDataOption:'INSERT_ROWS',
      requestBody:{values:filas}
    });
    res.json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
 
app.get('/', function(req, res) { res.json({status:'Caresse Bot corriendo OK'}); });
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Servidor en puerto '+PORT); });
