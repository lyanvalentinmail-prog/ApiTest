export const MENU = `୨୧ ❏ ◇ ᴀɪ

┊ ✿ .ᴄʜᴀᴛ <ᴍᴇɴꜱᴀᴊᴇ> Ⓛ

┊ ✿ .ᴀꜱᴋ <ᴘʀᴇɢᴜɴᴛᴀ> Ⓛ

┊ ✿ .ɢʀᴀᴍᴍᴀʀ <ᴛᴇxᴛᴏ>

┊ ✿ .ɪᴍᴀɢɪɴᴇ <ᴘʀᴏᴍᴘᴛ> Ⓟ

୨୧

ᴛᴏᴛᴀʟ : 4 ꜰɪᴛᴜʀ

Ⓟ ᴘʀᴇᴍɪᴜᴍ Ⓛ ʟɪᴍɪᴛ Ⓞ ᴏᴡɴᴇʀ Ⓐ ᴀᴅᴍɪɴ`;

export const EXTRA_HELP = `

*Modelos AI/ML API (catálogo en vivo)*
• ${".model"} — muestra tu modelo de texto actual.
• ${".model <id>"} — usa cualquier modelo de texto del catálogo.
• ${".models [búsqueda]"} — busca modelos disponibles ahora.
• ${".imagemodel <id>"} — selecciona el modelo de imagen para .imagine.
• ${".clear"} — borra tu contexto de .chat.

Ejemplo: .model openai/gpt-4o
Los comandos de imagen son premium; owner siempre tiene acceso.`;

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
