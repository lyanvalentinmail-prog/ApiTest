import ask from './ai/ask.js';
import chat from './ai/chat.js';
import grammar from './ai/grammar.js';
import imagine from './image/imagine.js';
import imageModel from './models/image-model.js';
import model from './models/model.js';
import models from './models/catalog.js';
import clear from './system/clear.js';
import menu from './system/menu.js';

/** Registro único: agrega un archivo aquí para que el comando aparezca y funcione. */
export const commands = [menu, clear, chat, ask, grammar, imagine, models, model, imageModel];

const commandByName = new Map();
for (const command of commands) {
  commandByName.set(command.name, command);
  for (const alias of command.aliases || []) commandByName.set(alias, command);
}

export function getCommand(name) {
  return commandByName.get(String(name || '').toLowerCase()) || null;
}

export function getMenuCommandGroups() {
  const groups = new Map();
  for (const command of commands) {
    if (!groups.has(command.category)) groups.set(command.category, []);
    groups.get(command.category).push(command);
  }
  return [...groups.entries()].map(([category, entries]) => ({ category, commands: entries }));
}
