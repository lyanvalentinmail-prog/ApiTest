/** Construye el menú principal con datos reales de la sesión, sin exponer variables internas de Termux. */
export function buildMainMenu({ botName, ownerName, version, mode, uptime, userName, prefix, totalCommands, commandGroups = [] }) {
  const header = `¡Hola, *${userName}* 🎌

*${botName}* está listo para acompañarte durante el día 🎐

Aquí tienes todos mis comandos 👇


╭──( *${botName}*)

║🎌 Nombre del bot ☇ *${botName}*

│⛩️ Propietario ☇ *${ownerName}*

║🏮 Versión ☇ *${version}*

│🍡 Modo ☇ *${mode}*

║🎴 Estado ☇ *Activo*

│🎐 Tiempo activo ☇ *${uptime}*

║🍙 Usuario ☇ *${userName}*

│🎋 Prefijo ☇ *${prefix}*

║🗾 Total de comandos ☇ *${totalCommands}*

╰━━━━━━━━━━━━━━━━━━━⬣`;

  return `${header}${formatCommandGroups(commandGroups, prefix)}`;
}

function formatCommandGroups(groups, prefix) {
  if (!groups.length) return '';
  const sections = groups.map(({ category, commands }) => {
    const rows = commands.map((command) => {
      const usage = command.usage ? ` ${command.usage}` : '';
      const aliases = (command.aliases || []).map((alias) => `${prefix}${alias}`).join(' | ');
      const aliasText = aliases ? `\n│   Alias: ${aliases}` : '';
      return `│ • *${prefix}${command.name}${usage}*\n│   ${command.description}${aliasText}`;
    });
    return `╭──〔 *${category}* 〕\n${rows.join('\n│\n')}\n╰━━━━━━━━━━━━━━━━━━━⬣`;
  });

  return `\n\n*LISTA COMPLETA DE COMANDOS*\n\n${sections.join('\n\n')}`;
}

/** Divide texto para no sobrepasar el límite de mensaje de WhatsApp. */
export function splitMessage(text, maxLength = 3500) {
  const value = String(text || '').trim();
  if (!value) return ['No se recibió contenido.'];
  if (value.length <= maxLength) return [value];

  const chunks = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n', maxLength);
    if (cut < maxLength * 0.55) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < maxLength * 0.55) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function jidNumber(jid = '') {
  return normalizePhone(String(jid).split('@')[0].split(':')[0]);
}

export function shortText(value, max = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function errorText(error) {
  const message = error instanceof Error ? error.message : String(error || 'Error desconocido');
  return shortText(message.replace(/Bearer\s+\S+/gi, 'Bearer [oculto]'), 700);
}
