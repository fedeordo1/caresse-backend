# Caresse Bot — Backend

## Instalación local

```bash
npm install
npm start
```

## Deploy en Railway (gratis)

1. Entrá a https://railway.app y creá una cuenta con tu Gmail
2. Clic en **"New Project"** → **"Deploy from GitHub repo"**
3. Subí esta carpeta a un repo de GitHub primero, o usá **"Deploy from local"**
4. Railway detecta automáticamente que es Node.js y lo despliega
5. Te da una URL pública tipo: `https://caresse-bot.up.railway.app`

## Variables de entorno (importante)

En Railway, en la sección **"Variables"**, agregá:

| Variable | Valor |
|----------|-------|
| `PRIVATE_KEY` | El contenido de `private_key` de tu nuevo JSON |
| `PRIVATE_KEY_ID` | El `private_key_id` de tu nuevo JSON |

Luego en server.js reemplazá las credenciales por:
```js
private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
private_key_id: process.env.PRIVATE_KEY_ID,
```

## URL del endpoint

`POST https://tu-url.railway.app/pedido`

Body JSON:
```json
{
  "ordenNumero": "ORD-20260329-1234",
  "fecha": "29/3/2026",
  "cliente": "Federico",
  "envio": "Correo Argentino",
  "items": [
    {
      "codigo": "2009",
      "producto": "Cortina Simple impresa 75 mic",
      "unidades": 30,
      "precioUnitario": 3037.57,
      "totalLinea": 91127.10
    }
  ],
  "total": 91127.10
}
```
