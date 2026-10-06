# ୨୧ AI — WhatsApp + Baileys + AI/ML API / Eden AI

Bot de WhatsApp en Node.js compatible con **Baileys**, **QR**, **código de vinculación** y **Termux**. Soporta [AI/ML API](https://api.aimlapi.com/v1) y [Eden AI](https://api.edenai.run/v3) para conversar, responder, corregir texto y generar imágenes.

> **Seguridad:** no se guarda ninguna clave real en este repositorio. Añade la tuya únicamente en `.env`, que está ignorado por Git. Si una clave se compartió en un chat, repositorio o captura, revócala/regénérala desde el panel del proveedor antes de usarla.

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
- **Catálogo vivo del proveedor activo**: `.models` consulta el catálogo de AI/ML API o Eden AI; no hay una lista fija que se vuelva obsoleta. Se puede seleccionar cualquier modelo de texto compatible y cualquier modelo de imagen detectado.
- No registra la clave API ni credenciales de WhatsApp.

## Requisitos

- Node.js **20 o superior**.
- Una cuenta de WhatsApp que se vinculará como dispositivo.
- Una clave de [AI/ML API](https://aimlapi.com/) o [Eden AI](https://app.edenai.run/).

## Instalación local

```bash
git clone <tu-repositorio>
cd ApiTest
npm install
cp .env.example .env
```

Edita `.env` y completa **un proveedor**:

```dotenv
# AI/ML API
AI_PROVIDER=aimlapi
AIMLAPI_API_KEY=tu_clave_de_aimlapi
```

```dotenv
# Eden AI
AI_PROVIDER=eden
EDENAI_API_KEY=tu_clave_de_eden
```

También puedes usar `AI_PROVIDER=auto`: si encuentra `EDENAI_API_KEY`, prioriza Eden; de lo contrario usa AI/ML API. No pongas comillas, no dejes espacios y **no subas `.env`**. En `.env` solo va la clave, no el ejemplo de JavaScript ni `<YOUR_API_KEY>`.

Comprueba la configuración sin revelar la clave:

```bash
npm run check:env
```

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

Si tu `.env` antiguo aún tiene `LINK_METHOD=qr`, usa `npm run link` para forzar el selector una vez. La terminal muestra:

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

Envía `.` o `.menu`. El encabezado usa los datos configurados en `.env` y muestra el usuario, tiempo real activo y el prefijo correcto del bot:

```text
¡Hola, *Usuario* 🎌

*NombreBot* está listo para acompañarte durante el día 🎐

Aquí tienes todos mis comandos 👇


╭──( *NombreBot*)

║🎌 Nombre del bot ☇ *NombreBot*

│⛩️ Propietario ☇ *Owner*

║🏮 Versión ☇ *1.0.0*

│🍡 Modo ☇ *Público*

║🎴 Estado ☇ *Activo*

│🎐 Tiempo activo ☇ *19s*

║🍙 Usuario ☇ *Usuario*

│🎋 Prefijo ☇ *.*

║🗾 Total de comandos ☇ *136*

╰━━━━━━━━━━━━━━━━━━━⬣
```

### Comandos principales

| Comando | Ejemplo | Acceso |
| --- | --- | --- |
| `.chat <mensaje>` | `.chat Explícame los agujeros negros` | límite diario |
| `.ask <pregunta>` | `.ask ¿Qué es una API REST?` | límite diario |
| `.grammar <texto>` | `.grammar ayer fuimos al cine y estuvo genial` | normal |
| `.imagine <prompt>` | `.imagine un gato astronauta, estilo acuarela` | premium / owner |
| `.clear` | `.clear` | normal |

### Carpeta `cmds/` y modelos de los proveedores

Los comandos están organizados en la carpeta raíz `cmds/`:

```text
cmds/
├── ai/       # chat, ask y grammar
├── image/    # imagine
├── models/   # catálogo y selección de todos los modelos
└── system/   # menu y clear
```

`.menu` se construye desde ese registro y muestra la lista completa de comandos disponibles. El bot no codifica una lista fija de modelos: obtiene el catálogo vivo de `https://api.aimlapi.com/v1/models` o `https://api.edenai.run/v3/models`, según el proveedor activo.

```text
.models                     # primeros modelos de texto del catálogo vivo
.models gemini              # busca IDs/aliases/capacidades
.models image               # modelos detectados para generar imagen
.models all                 # TODO el catálogo vivo del proveedor activo
.models all image           # todos los modelos de imagen
.model                      # muestra el modelo de texto actual
.model openai/gpt-4o        # cambia el modelo de texto
.imagemodel image/generation/minimax  # Eden: cambia el modelo de imagen (premium/owner)
```

El catálogo completo puede llegar en varios mensajes. `.model` permite seleccionar solo modelos compatibles con chat y `.imagemodel` solo modelos de imagen; las demás modalidades del catálogo se muestran con `.models all`, pero necesitan sus propios endpoints para utilizarse.

## Configuración

| Variable | Descripción | Predeterminado |
| --- | --- | --- |
| `AI_PROVIDER` | `auto`, `aimlapi` o `eden`. Auto prioriza Eden si hay clave Eden. | `auto` |
| `AIMLAPI_API_KEY` | Clave privada de AI/ML API si usas ese proveedor. | — |
| `EDENAI_API_KEY` | Clave privada de Eden AI si usas Eden. | — |
| `DEFAULT_TEXT_MODEL` | Modelo inicial de chat/ask/grammar. | según proveedor |
| `DEFAULT_IMAGE_MODEL` | Modelo inicial de imagine. | según proveedor |
| `LINK_METHOD` | `ask` (selector), `qr` o `pairing`. | `ask` |
| `PAIRING_NUMBER` | Número para código, con prefijo de país. | vacío |
| `OWNER_NUMBERS` | Números internacionales separados por coma. | vacío |
| `PREMIUM_NUMBERS` | Números internacionales separados por coma. | vacío |
| `DAILY_LIMIT` | Usos diarios de chat/ask para no premium. | `10` |
| `BOT_NAME` | Nombre mostrado en `.menu`. | `NombreBot` |
| `OWNER_NAME` | Propietario mostrado en `.menu`. | `Owner` |
| `BOT_VERSION` | Versión mostrada en `.menu`. | `1.0.0` |
| `BOT_MODE` | Modo mostrado en `.menu`. | `Público` |
| `MENU_TOTAL` | Total decorativo mostrado en `.menu`. | `136` |
| `BOT_PREFIX` | Prefijo de comandos. (No uses `PREFIX`: Termux reserva esa variable.) | `.` |

Ejemplo de permisos:

```dotenv
OWNER_NUMBERS=5215551234567
PREMIUM_NUMBERS=5215557654321,5215550000000
DAILY_LIMIT=15
```

Los números se escriben **sin `+`, guiones ni espacios**. Owner siempre se considera premium.

## Notas operativas

- El modelo de imagen por defecto puede tener coste. Revisa el catálogo y saldo del proveedor activo antes de habilitar premium.
- `.menu` y los demás comandos aceptan mensajes desde *Mensaje para ti* y desde cualquier otro chat. La salida propia del bot se identifica para no crear bucles.
- `.chat` guarda un contexto corto en `data/state.json`; `.clear` lo elimina. Ese estado y la sesión están ignorados por Git.
- Si el bot deja de responder, revisa que Node siga activo, que la sesión no se haya cerrado y que la cuenta del proveedor activo tenga saldo/permisos para el modelo elegido.
