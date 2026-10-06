import 'dotenv/config';

import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  isJidBroadcast,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

import { AimlApiClient, isProbablyChatModel, isProbablyImageModel, modelCapabilities, resolveModel } from './lib/aimlapi.js';
import { EdenAiClient } from './lib/edenai.js';
import { buildMainMenu, errorText, jidNumber, normalizePhone, shortText, splitMessage } from './lib/format.js';
import { StateStore } from './lib/store.js';
import { getCommand, getMenuCommandGroups } from '../cmds/index.js';

const startedAt = Date.now();
const config = createConfig();
const api = config.provider === 'eden'
  ? new EdenAiClient({ apiKey: config.apiKey })
  : new AimlApiClient({ apiKey: config.apiKey });
const state = new StateStore(config.dataFile);
const activeRequests = new Set();
// IDs de mensajes enviados por el bot. Permite aceptar comandos escritos desde la
// cuenta vinculada sin volver a procesar las respuestas propias del bot.
const botMessageIds = new Set();
let reconnectTimer = null;
let terminalQuestion = null;
let pairingRequested = false;

await state.load();
await startWhatsApp();

function createConfig() {
  const args = process.argv.slice(2);
  // Termux define $PREFIX con su ruta de instalación; no puede usarse como prefijo del bot.
  // BOT_PREFIX es la variable preferida. Se acepta el antiguo PREFIX solo si parece un prefijo corto.
  const legacyPrefix = process.env.PREFIX;
  const prefix = process.env.BOT_PREFIX || (legacyPrefix && legacyPrefix.length <= 3 ? legacyPrefix : '.');
  const pairingFromArgument = readOption(args, '--pairing') || readOption(args, '--pair');
  const wantsPairing = args.includes('--pairing') || args.includes('--pair') || Boolean(pairingFromArgument);
  const wantsQr = args.includes('--qr');
  const wantsChooser = args.includes('--choose');
  const configuredMethod = String(process.env.LINK_METHOD || 'ask').toLowerCase();
  // --choose permite abrir el selector incluso si un .env antiguo aún contiene LINK_METHOD=qr.
  const linkMethod = wantsQr ? 'qr' : wantsPairing ? 'pairing' : wantsChooser ? 'ask' : configuredMethod;
  const pairingNumber = normalizePhone(pairingFromArgument || process.env.PAIRING_NUMBER || '');
  const aimlApiKey = configuredApiKey();
  const edenApiKey = configuredEdenApiKey();
  const provider = configuredProvider({ aimlApiKey, edenApiKey });

  if (!prefix || prefix.length > 3) throw new Error('BOT_PREFIX debe tener entre 1 y 3 caracteres.');
  if (!['ask', 'qr', 'pairing'].includes(linkMethod)) {
    throw new Error('LINK_METHOD debe ser ask, qr o pairing.');
  }

  return {
    provider,
    // AIMLAPI_API_KEY y EDENAI_API_KEY son los nombres recomendados.
    apiKey: provider === 'eden' ? edenApiKey : aimlApiKey,
    prefix,
    botName: process.env.BOT_NAME || 'NombreBot',
    ownerName: process.env.OWNER_NAME || 'Owner',
    botVersion: process.env.BOT_VERSION || '1.0.0',
    botMode: process.env.BOT_MODE || 'Público',
    menuTotal: positiveInteger(process.env.MENU_TOTAL, 136),
    linkMethod,
    pairingNumber,
    sessionDir: resolve(process.env.SESSION_DIR || 'sessions/baileys'),
    dataFile: resolve(process.env.DATA_FILE || 'data/state.json'),
    defaultTextModel: process.env.DEFAULT_TEXT_MODEL || (provider === 'eden' ? 'google/gemini-2.5-flash' : 'google/gemma-3-4b-it'),
    defaultImageModel: process.env.DEFAULT_IMAGE_MODEL || (provider === 'eden' ? 'image/generation/minimax' : 'flux-pro'),
    dailyLimit: positiveInteger(process.env.DAILY_LIMIT, 10),
    ownerNumbers: numberSet(process.env.OWNER_NUMBERS),
    premiumNumbers: numberSet(process.env.PREMIUM_NUMBERS),
  };
}

function configuredApiKey() {
  const candidates = [
    process.env.AIMLAPI_API_KEY,
    process.env.AIMLAPI_KEY,
    process.env.AI_ML_API_KEY,
  ].map((value) => String(value || '').trim());

  return candidates.find((key) => key && !/^(pega_tu_clave_aqui|your_api_key|<your_aimlapi_key>)$/i.test(key)) || '';
}

function configuredEdenApiKey() {
  const candidates = [
    process.env.EDENAI_API_KEY,
    process.env.EDEN_AI_API_KEY,
    process.env.EDEN_API_KEY,
  ].map((value) => String(value || '').trim());

  return candidates.find((key) => key && !/^(pega_tu_clave_aqui|your_api_key|<your_eden_ai_api_key>)$/i.test(key)) || '';
}

function configuredProvider({ aimlApiKey, edenApiKey }) {
  const requested = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (!['auto', 'aimlapi', 'eden'].includes(requested)) {
    throw new Error('AI_PROVIDER debe ser auto, aimlapi o eden.');
  }
  if (requested === 'eden') return 'eden';
  if (requested === 'aimlapi') return 'aimlapi';
  // En modo automático se prioriza Eden cuando una clave de Eden está configurada.
  return edenApiKey ? 'eden' : 'aimlapi';
}

function readOption(args, option) {
  const equals = args.find((arg) => arg.startsWith(`${option}=`));
  if (equals) return equals.slice(option.length + 1);
  const index = args.indexOf(option);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : '';
}

function numberSet(value = '') {
  return new Set(String(value).split(',').map(normalizePhone).filter(Boolean));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function startWhatsApp() {
  await mkdir(config.sessionDir, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  await chooseLinkMethod(authState);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (error) {
    console.warn('[baileys] No se pudo consultar la versión web actual; se usará la incluida.', error.message);
  }

  const sock = makeWASocket({
    version,
    auth: authState,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    // Necesario para recibir .menu y otros comandos enviados desde la cuenta vinculada.
    emitOwnEvents: true,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !authState.creds.registered) {
      if (config.linkMethod === 'pairing') {
        await requestPairingCode(sock);
      } else {
        console.log('\nEscanea este QR desde WhatsApp > Dispositivos vinculados > Vincular dispositivo:\n');
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'open') {
      console.log(`\n✓ ${config.botName} conectado a WhatsApp.`);
      console.log(`[IA] Proveedor activo: ${config.provider === 'eden' ? 'Eden AI' : 'AI/ML API'}.`);
      console.log(`[comandos] Listo. Envía ${config.prefix}menu desde cualquier chat, incluida la cuenta vinculada.`);
      closeQuestion();
      return;
    }

    if (connection === 'close') {
      const statusCode = disconnectStatus(lastDisconnect?.error);
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`[baileys] Conexión cerrada (${statusCode || 'motivo desconocido'}).`);
      if (loggedOut) {
        closeQuestion();
        console.log(`[baileys] La sesión cerró. Borra ${config.sessionDir} y vuelve a vincular el bot.`);
      } else {
        scheduleReconnect();
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    // No se filtra por `type`: Baileys puede entregar mensajes propios como
    // "append" y mensajes nuevos como "notify". Ambos deben aceptar comandos.
    for (const message of messages) {
      handleIncomingMessage(sock, message).catch((error) => console.error('[mensaje]', errorText(error)));
    }
  });
}

function disconnectStatus(error) {
  if (!error) return 0;
  if (error?.output?.statusCode || error?.statusCode) {
    return error.output?.statusCode || error.statusCode;
  }
  const boom = new Boom(error instanceof Error ? error.message : String(error));
  return boom?.output?.statusCode || 0;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  pairingRequested = false;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsApp().catch((error) => {
      console.error('[baileys] Error al reconectar:', errorText(error));
      scheduleReconnect();
    });
  }, 4_000);
}

/** Muestra el selector solo al vincular una sesión nueva; no molesta en reconexiones normales. */
async function chooseLinkMethod(authState) {
  if (authState.creds.registered || config.linkMethod !== 'ask') return;

  if (!process.stdin.isTTY) {
    config.linkMethod = 'qr';
    console.warn('[vinculación] No hay terminal interactiva; se usará QR. Usa --pairing o LINK_METHOD=pairing para forzar código.');
    return;
  }

  console.log('\n¿Cómo deseas vincular WhatsApp?\n  1) Código QR\n  2) Código de vinculación\n');
  while (true) {
    const choice = (await askTerminal('Elige 1 o 2: ')).trim();
    if (choice === '1' || choice.toLowerCase() === 'qr') {
      config.linkMethod = 'qr';
      closeQuestion();
      console.log('Se usará QR.');
      return;
    }
    if (choice === '2' || ['code', 'codigo', 'código', 'pairing'].includes(choice.toLowerCase())) {
      const phone = normalizePhone(await askTerminal('Número con código de país (solo dígitos): '));
      if (phone.length >= 8 && phone.length <= 16) {
        config.linkMethod = 'pairing';
        config.pairingNumber = phone;
        closeQuestion();
        console.log('Se solicitará un código de vinculación.');
        return;
      }
      console.log('Número inválido. Incluye el código de país, sin + ni espacios.');
      continue;
    }
    console.log('Opción inválida. Escribe 1 para QR o 2 para código.');
  }
}

async function requestPairingCode(sock) {
  if (pairingRequested) return;
  pairingRequested = true;
  try {
    const phone = config.pairingNumber || await askTerminal('Número con código de país (solo dígitos): ');
    const normalized = normalizePhone(phone);
    if (normalized.length < 8 || normalized.length > 16) {
      throw new Error('El número debe incluir código de país y tener entre 8 y 16 dígitos.');
    }
    const code = await sock.requestPairingCode(normalized);
    console.log(`\nCódigo de vinculación: ${code}\nEn WhatsApp: Dispositivos vinculados > Vincular un dispositivo > Vincular con número de teléfono.\n`);
  } catch (error) {
    pairingRequested = false;
    console.error('[vinculación] No se pudo obtener el código:', errorText(error));
  }
}

function askTerminal(question) {
  if (!terminalQuestion) {
    terminalQuestion = createInterface({ input: process.stdin, output: process.stdout });
  }
  return new Promise((resolveQuestion) => terminalQuestion.question(question, resolveQuestion));
}

function closeQuestion() {
  if (terminalQuestion) {
    terminalQuestion.close();
    terminalQuestion = null;
  }
}

async function handleIncomingMessage(sock, message) {
  if (!message?.message || !message?.key?.remoteJid) return;
  // Ignora únicamente mensajes que este proceso acaba de enviar; los comandos
  // escritos por la misma cuenta vinculada sí se procesan.
  if (message.key.fromMe && botMessageIds.has(message.key.id)) return;

  const chatJid = message.key.remoteJid;
  if (isJidBroadcast(chatJid) || chatJid === 'status@broadcast') return;

  const text = readMessageText(message.message);
  if (!text || !text.startsWith(config.prefix)) return;

  const parsed = parseCommand(text);
  if (!parsed) return;
  const senderJid = message.key.participant || chatJid;
  console.log(`[comando] ${config.prefix}${parsed.command} recibido de ${jidNumber(senderJid) || senderJid}`);
  const senderNumber = jidNumber(senderJid);
  const identity = senderJid || chatJid;
  const userName = shortText(message.pushName || senderNumber || 'Usuario', 80);
  const owner = config.ownerNumbers.has(senderNumber);
  const premium = owner || config.premiumNumbers.has(senderNumber);

  try {
    await sock.sendPresenceUpdate('composing', chatJid).catch(() => {});
    await runCommand({ sock, message, chatJid, identity, userName, owner, premium, ...parsed });
  } catch (error) {
    console.error('[comando]', errorText(error));
    await sendText({ sock, message, chatJid }, `୨୧ No pude completar el comando.\n${errorText(error)}`);
  } finally {
    await sock.sendPresenceUpdate('paused', chatJid).catch(() => {});
  }
}

function readMessageText(content) {
  const type = getContentType(content);
  if (!type) return '';
  const payload = content[type];
  if (type === 'conversation') return payload || '';
  if (type === 'extendedTextMessage') return payload?.text || '';
  if (type === 'imageMessage' || type === 'videoMessage') return payload?.caption || '';
  return '';
}

function parseCommand(text) {
  const withoutPrefix = text.slice(config.prefix.length).trim();
  if (!withoutPrefix) return { command: 'menu', args: '' };
  const [first, ...rest] = withoutPrefix.split(/\s+/);
  const command = getCommand(first);
  return command ? { command: command.name, args: rest.join(' ').trim() } : null;
}

function formatUptime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${remainingSeconds}s`);
  return parts.join(' ');
}

async function runCommand(context) {
  const command = getCommand(context.command);
  if (!command) return undefined;

  return command.execute(context, {
    state,
    sendText,
    runMenu,
    runChat,
    runAsk,
    runGrammar,
    runImagine,
    runModel,
    runImageModel,
    runModels,
  });
}

async function runMenu(context) {
  return sendText(context, buildMainMenu({
    botName: config.botName,
    ownerName: config.ownerName,
    version: config.botVersion,
    mode: config.botMode,
    uptime: formatUptime(Date.now() - startedAt),
    userName: context.userName || 'Usuario',
    prefix: config.prefix,
    totalCommands: config.menuTotal,
    commandGroups: getMenuCommandGroups(),
  }));
}

async function runChat(context, prompt) {
  if (!prompt) return sendText(context, `Uso: ${config.prefix}chat <mensaje>`);
  if (!(await reserveLimitedUse(context))) return;

  await withUserRequest(context, async () => {
    const { model } = await selectedModels(context.identity);
    const history = await state.getHistory(context.identity);
    const messages = [
      { role: 'system', content: 'Eres un asistente útil. Responde en el idioma de la persona, con precisión y de forma clara.' },
      ...history,
      { role: 'user', content: prompt },
    ];
    const answer = await api.chat({ model, messages, temperature: 0.7, maxTokens: 1100 });
    await state.addHistory(context.identity, 'user', prompt);
    await state.addHistory(context.identity, 'assistant', answer);
    return sendText(context, `୨୧ ❏ ◇ ᴀɪ\n\n${answer}`);
  });
}

async function runAsk(context, question) {
  if (!question) return sendText(context, `Uso: ${config.prefix}ask <pregunta>`);
  if (!(await reserveLimitedUse(context))) return;

  await withUserRequest(context, async () => {
    const { model } = await selectedModels(context.identity);
    const answer = await api.chat({
      model,
      messages: [
        { role: 'system', content: 'Responde la pregunta de forma útil, clara y honesta. Si no sabes algo, dilo.' },
        { role: 'user', content: question },
      ],
      temperature: 0.45,
      maxTokens: 1100,
    });
    return sendText(context, `୨୧ ❏ ◇ ᴀɪ\n\n${answer}`);
  });
}

async function runGrammar(context, text) {
  if (!text) return sendText(context, `Uso: ${config.prefix}grammar <texto>`);
  await withUserRequest(context, async () => {
    const { model } = await selectedModels(context.identity);
    const answer = await api.chat({
      model,
      messages: [
        {
          role: 'system',
          content: 'Corrige únicamente ortografía, gramática y puntuación. Conserva el idioma, el sentido y el tono. Devuelve primero el texto corregido y después una lista muy breve de cambios solo si hubo correcciones.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      maxTokens: 900,
    });
    return sendText(context, `୨୧ ❏ ◇ ɢʀᴀᴍᴍᴀʀ\n\n${answer}`);
  });
}

async function runImagine(context, prompt) {
  if (!prompt) return sendText(context, `Uso: ${config.prefix}imagine <prompt>`);
  if (!context.premium) {
    return sendText(context, '୨୧ Este comando es Ⓟ premium. Configura PREMIUM_NUMBERS en .env para habilitarlo.');
  }

  await withUserRequest(context, async () => {
    const { imageModel } = await selectedModels(context.identity);
    const image = await api.generateImage({ model: imageModel, prompt });
    const caption = `୨୧ ❏ ◇ ɪᴍᴀɢɪɴᴇ\n
Modelo: ${imageModel}\nPrompt: ${shortText(prompt, 500)}`;
    const sent = await context.sock.sendMessage(context.chatJid, {
      image: image.url ? { url: image.url } : image.buffer,
      caption,
    }, { quoted: context.message });
    rememberBotMessage(sent);
  });
}

async function runModel(context, requested) {
  const selected = await selectedModels(context.identity);
  if (!requested) {
    return sendText(context, `Modelo de texto actual: ${selected.model}\n\nUsa ${config.prefix}models <búsqueda> para consultar el catálogo vivo.\nLuego: ${config.prefix}model <id>`);
  }

  const model = await validateModel(requested, false);
  if (!model) return;
  await state.setModel(context.identity, model.id);
  return sendText(context, `୨୧ Modelo de texto seleccionado:\n${model.id}\n\nEl contexto anterior de .chat fue eliminado.`);
}

async function runImageModel(context, requested) {
  const selected = await selectedModels(context.identity);
  if (!requested) {
    return sendText(context, `Modelo de imagen actual: ${selected.imageModel}\n\nUsa ${config.prefix}models image y después ${config.prefix}imagemodel <id>.`);
  }
  if (!context.premium) return sendText(context, '୨୧ Solo Ⓟ premium u Ⓞ owner puede elegir un modelo de imagen.');

  const model = await validateModel(requested, true);
  if (!model) return;
  await state.setModel(context.identity, model.id, { image: true });
  return sendText(context, `୨୧ Modelo de imagen seleccionado:\n${model.id}`);
}

async function validateModel(requested, image) {
  const models = await api.listModels();
  const model = resolveModel(models, requested);
  if (!model) {
    throw new Error(`El modelo "${requested}" no aparece en el catálogo actual. Usa ${config.prefix}models <búsqueda>.`);
  }
  if (image && !isProbablyImageModel(model)) {
    throw new Error(`"${model.id}" no está marcado como modelo de imagen. Usa ${config.prefix}models image.`);
  }
  if (!image && !isProbablyChatModel(model)) {
    throw new Error(`"${model.id}" no está marcado como modelo para chat. Usa ${config.prefix}models <búsqueda>.`);
  }
  return model;
}

async function runModels(context, query) {
  await withUserRequest(context, async () => {
    const models = await api.listModels();
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const showAll = tokens.includes('all') || tokens.includes('todos');
    const imageOnly = tokens.some((token) => ['image', 'imagen', 'imagine'].includes(token));
    const search = tokens.filter((token) => !['all', 'todos', 'image', 'imagen', 'imagine'].includes(token)).join(' ');
    const fingerprint = (model) => `${model.id || ''} ${(model.aliases || []).join(' ')} ${modelCapabilities(model)}`.toLowerCase();

    const matching = models.filter((model) => {
      if (imageOnly && !isProbablyImageModel(model)) return false;
      // .models all muestra todo el catálogo AI/ML API, incluso modalidades
      // que no se usan con los comandos chat/imagine.
      if (!imageOnly && !showAll && !isProbablyChatModel(model)) return false;
      return !search || fingerprint(model).includes(search);
    });
    const results = showAll ? matching : matching.slice(0, 25);

    if (!results.length) {
      return sendText(context, `No encontré modelos con esa búsqueda. Prueba: ${config.prefix}models openai, ${config.prefix}models image o ${config.prefix}models all`);
    }
    const heading = showAll
      ? imageOnly ? 'Todos los modelos de imagen' : `Catálogo completo de ${config.provider === 'eden' ? 'Eden AI' : 'AI/ML API'}`
      : imageOnly ? 'Modelos de imagen' : `Modelos encontrados${query ? `: ${query}` : ''}`;
    const lines = results.map((model, index) => {
      const imageTag = isProbablyImageModel(model) ? ' 🖼️' : '';
      return `${index + 1}. ${model.id}${imageTag}`;
    });
    const selector = imageOnly ? `${config.prefix}imagemodel <id>` : `${config.prefix}model <id>`;
    const note = showAll
      ? `\n\nSe enviará en varios mensajes si el catálogo es largo. Selecciona con ${selector}.`
      : `\n\nSelecciona con ${selector}. Usa ${config.prefix}models all para ver todo el catálogo.`;
    return sendText(context, `୨୧ ${heading} (${results.length}${!showAll && results.length === 25 ? '+' : ''})\n\n${lines.join('\n')}${note}`);
  });
}

async function selectedModels(identity) {
  const preferences = await state.userPreferences(identity);
  return {
    model: preferences.model || config.defaultTextModel,
    imageModel: preferences.imageModel || config.defaultImageModel,
  };
}

async function reserveLimitedUse(context) {
  if (context.premium) return true;
  const use = await state.consumeDailyUse(context.identity, config.dailyLimit);
  if (use.allowed) return true;
  await sendText(context, `୨୧ Alcanzaste tu límite diario de ${config.dailyLimit} consultas Ⓛ. Vuelve mañana o solicita acceso premium.`);
  return false;
}

async function withUserRequest(context, task) {
  if (activeRequests.has(context.identity)) {
    return sendText(context, '୨୧ Ya estoy procesando una solicitud tuya. Espera un momento.');
  }
  activeRequests.add(context.identity);
  try {
    return await task();
  } catch (error) {
    console.error('[AI]', errorText(error));
    return sendText(context, `୨୧ No pude completar la solicitud.\n${errorText(error)}`);
  } finally {
    activeRequests.delete(context.identity);
  }
}

async function sendText(context, text) {
  const chunks = splitMessage(text);
  for (let index = 0; index < chunks.length; index += 1) {
    const sent = await context.sock.sendMessage(
      context.chatJid,
      { text: chunks[index] },
      index === 0 ? { quoted: context.message } : undefined,
    );
    rememberBotMessage(sent);
  }
}

function rememberBotMessage(sent) {
  const id = sent?.key?.id;
  if (!id) return;
  botMessageIds.add(id);
  // Evita que el registro en memoria crezca en ejecuciones largas.
  if (botMessageIds.size > 500) {
    botMessageIds.delete(botMessageIds.values().next().value);
  }
}
