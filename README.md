# ୨୧ AI — WhatsApp + Baileys + AI/ML API

Bot de WhatsApp en Node.js compatible con **Baileys**, **QR**, **código de vinculación** y **Termux**. Usa el endpoint OpenAI-compatible de [AI/ML API](https://api.aimlapi.com/v1) para conversar, responder, corregir texto y generar imágenes.

> **Seguridad:** no se guarda ninguna clave real en este repositorio. Añade la tuya únicamente en `.env`, que está ignorado por Git. Si una clave se compartió en un chat, repositorio o captura, revócala/regénérala en el panel de AI/ML API antes de usarla.

## Características

- **Baileys** con sesión persistente multiarchivo (`sessions/baileys/`), sin QR deprecado.
- Vinculación por **QR** o **código de 8 dígitos**, incluido número por argumento o variable de entorno.
- Compatible con **Node.js 20+** y Termux.
- Menú con el diseño solicitado y cuatro funciones principales:
  - `.chat <mensaje>`: conversación con contexto breve por usuario.
  - `.ask <pregunta>`: consulta de una sola respuesta.
  - `.grammar <texto>`: corrección de gramática, puntuación y ortografía.
  - `.imagine <prompt>`: generación de imagen para premium/owner.
- Límites diarios para `.chat` y `.ask`; owner y premium no consumen límite.
- Listas de owner y premium configurables por `.env`.
- **Catálogo vivo de AI/ML API**: `.models` consulta `GET /v1/models`; no hay una lista fija que se vuelva obsoleta. Se puede seleccionar cualquier modelo de texto compatible y cualquier modelo de imagen detectado del catálogo.
- No registra la clave API ni credenciales de WhatsApp.

## Requisitos

- Node.js **20 o superior**.
- Una cuenta de WhatsApp que se vinculará como dispositivo.
- Una clave de [AI/ML API](https://aimlapi.com/).

## Instalación local

```bash
git clone <tu-repositorio>
cd ApiTest
npm install
cp .env.example .env
```

Edita `.env` y completa como mínimo:

```dotenv
AIMLAPI_API_KEY=tu_clave_de_aimlapi
```

No pongas comillas, no dejes espacios y **no subas `.env`**.

Valida la sintaxis antes de arrancar:

```bash
npm run check
```

## Vincular WhatsApp

La primera vez se crea `sessions/baileys/` con las credenciales. No lo compartas ni lo subas a Git.

### Selector interactivo — QR o código (predeterminado)

En una sesión nueva, ejecuta:

```bash
npm start
```

La terminal muestra:

```text
¿Cómo deseas vincular WhatsApp?
  1) Código QR
  2) Código de vinculación
```

- Escribe **`1`** para mostrar el QR y escanéalo desde **WhatsApp → Dispositivos vinculados → Vincular un dispositivo**.
- Escribe **`2`** para introducir tu número con prefijo de país; el bot mostrará el código de 8 dígitos.

El selector solo aparece al crear una sesión. Si ya hay una sesión vinculada, el bot se reconecta directamente.

### Forzar QR o código desde el comando

```bash
npm run qr
npm run pair -- 5215551234567
```

También puedes fijarlo en `.env`:

```dotenv
LINK_METHOD=pairing
PAIRING_NUMBER=5215551234567
```

En WhatsApp abre **Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono** e introduce el código de 8 dígitos que muestra la terminal.

Para cambiar de cuenta, detén el bot y borra solo la carpeta de sesión:

```bash
rm -rf sessions/baileys
```

> Nunca borres `.env` si quieres conservar tu configuración; tampoco compartas los archivos de `sessions/`.

## Uso en Termux

```bash
pkg update && pkg upgrade
pkg install nodejs-lts git

git clone <tu-repositorio>
cd ApiTest
npm install
cp .env.example .env
nano .env
npm start
```

Para vincular por código:

```bash
npm run pair -- 5215551234567
```

Mantén Termux abierto mientras el bot esté activo. Para una sesión larga puedes usar `tmux`:

```bash
pkg install tmux
tmux new -s wa-bot
npm start
```

Usa `Ctrl+B` y después `D` para dejar la sesión corriendo; vuelve con `tmux attach -t wa-bot`.

## Menú enviado por el bot

Envía `.` o `.menu`:

```text
୨୧ ❏ ◇ ᴀɪ

┊ ✿ .ᴄʜᴀᴛ <ᴍᴇɴꜱᴀᴊᴇ> Ⓛ

┊ ✿ .ᴀꜱᴋ <ᴘʀᴇɢᴜɴᴛᴀ> Ⓛ

┊ ✿ .ɢʀᴀᴍᴍᴀʀ <ᴛᴇxᴛᴏ>

┊ ✿ .ɪᴍᴀɢɪɴᴇ <ᴘʀᴏᴍᴘᴛ> Ⓟ

୨୧

ᴛᴏᴛᴀʟ : 4 ꜰɪᴛᴜʀ

Ⓟ ᴘʀᴇᴍɪᴜᴍ Ⓛ ʟɪᴍɪᴛ Ⓞ ᴏᴡɴᴇʀ Ⓐ ᴀᴅᴍɪɴ
```

### Comandos principales

| Comando | Ejemplo | Acceso |
| --- | --- | --- |
| `.chat <mensaje>` | `.chat Explícame los agujeros negros` | límite diario |
| `.ask <pregunta>` | `.ask ¿Qué es una API REST?` | límite diario |
| `.grammar <texto>` | `.grammar ayer fuimos al cine y estuvo genial` | normal |
| `.imagine <prompt>` | `.imagine un gato astronauta, estilo acuarela` | premium / owner |
| `.clear` | `.clear` | normal |

### Modelos de AI/ML API

El bot no codifica una lista de modelos: la obtiene de `https://api.aimlapi.com/v1/models` y guarda la elección por usuario.

```text
.models                     # primeros modelos del catálogo vivo
.models gemini              # busca IDs/aliases/capacidades
.models image               # modelos detectados para generar imagen
.model                      # muestra el modelo de texto actual
.model openai/gpt-4o        # cambia el modelo de texto
.imagemodel flux-pro        # cambia el modelo de imagen (premium/owner)
```

Así quedan disponibles los modelos de chat e imagen que AI/ML API mantenga activos en ese momento, sin actualizar el código. La compatibilidad concreta (precio, disponibilidad, moderación, formatos o parámetros) depende del modelo y de los créditos de tu cuenta AI/ML API. Los modelos de audio, vídeo, embeddings u otras modalidades no usan los cuatro comandos de este bot; requieren un flujo y endpoint específicos.

## Configuración

| Variable | Descripción | Predeterminado |
| --- | --- | --- |
| `AIMLAPI_API_KEY` | Clave privada de AI/ML API. Obligatoria. | — |
| `DEFAULT_TEXT_MODEL` | Modelo inicial de chat/ask/grammar. | `google/gemma-3-4b-it` |
| `DEFAULT_IMAGE_MODEL` | Modelo inicial de imagine. | `flux-pro` |
| `LINK_METHOD` | `ask` (selector), `qr` o `pairing`. | `ask` |
| `PAIRING_NUMBER` | Número para código, con prefijo de país. | vacío |
| `OWNER_NUMBERS` | Números internacionales separados por coma. | vacío |
| `PREMIUM_NUMBERS` | Números internacionales separados por coma. | vacío |
| `DAILY_LIMIT` | Usos diarios de chat/ask para no premium. | `10` |
| `ALLOW_SELF_COMMANDS` | Permite comandos desde la propia cuenta vinculada. | `false` |
| `BOT_PREFIX` | Prefijo de comandos. (No uses `PREFIX`: Termux reserva esa variable.) | `.` |

Ejemplo de permisos:

```dotenv
OWNER_NUMBERS=5215551234567
PREMIUM_NUMBERS=5215557654321,5215550000000
DAILY_LIMIT=15
```

Los números se escriben **sin `+`, guiones ni espacios**. Owner siempre se considera premium.

## Notas operativas

- El modelo de imagen por defecto puede tener coste. Revisa el catálogo y saldo de AI/ML API antes de habilitar premium.
- Para ejecutar comandos desde *Mensaje para ti*, usa `ALLOW_SELF_COMMANDS=true`; déjalo en `false` normalmente para no procesar mensajes enviados por el propio bot.
- `.chat` guarda un contexto corto en `data/state.json`; `.clear` lo elimina. Ese estado y la sesión están ignorados por Git.
- Si el bot deja de responder, revisa que Node siga activo, que la sesión no se haya cerrado y que la cuenta de AI/ML API tenga saldo/permisos para el modelo elegido.
