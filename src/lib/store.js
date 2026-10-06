import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_CHARS = 1800;

/** Persistencia local atómica para preferencias, límite diario y contexto corto. */
export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { users: {} };
    this.queue = Promise.resolve();
  }

  async load() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const content = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') this.state = { users: {}, ...parsed };
      if (!this.state.users || typeof this.state.users !== 'object') this.state.users = {};
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[estado] No se pudo leer el estado anterior; se creará uno nuevo.', error.message);
      }
    }
  }

  async mutate(callback) {
    let result;
    this.queue = this.queue.then(async () => {
      result = await callback(this.state);
      await this.persist();
    });
    await this.queue;
    return result;
  }

  async persist() {
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await rename(temporary, this.filePath);
  }

  getUser(jid) {
    if (!this.state.users[jid]) {
      this.state.users[jid] = {
        daily: { day: '', used: 0 },
        model: '',
        imageModel: '',
        history: [],
      };
    }
    const user = this.state.users[jid];
    if (!Array.isArray(user.history)) user.history = [];
    return user;
  }

  async userPreferences(jid) {
    return this.mutate((state) => {
      const user = getUserFromState(state, jid);
      return { model: user.model || '', imageModel: user.imageModel || '' };
    });
  }

  async setModel(jid, model, { image = false } = {}) {
    return this.mutate((state) => {
      const user = getUserFromState(state, jid);
      if (image) user.imageModel = model;
      else {
        user.model = model;
        // Un modelo distinto no debe mezclar respuestas de un contexto anterior.
        user.history = [];
      }
    });
  }

  async clearHistory(jid) {
    return this.mutate((state) => {
      getUserFromState(state, jid).history = [];
    });
  }

  async getHistory(jid) {
    return this.mutate((state) => getUserFromState(state, jid).history.slice(-MAX_HISTORY_ITEMS));
  }

  async addHistory(jid, role, content) {
    const compact = String(content || '').replace(/\s+/g, ' ').trim().slice(0, MAX_HISTORY_CHARS);
    if (!compact) return;
    return this.mutate((state) => {
      const user = getUserFromState(state, jid);
      user.history.push({ role, content: compact });
      user.history = user.history.slice(-MAX_HISTORY_ITEMS);
    });
  }

  /** Reserva un uso antes de llamar a la API para que mensajes simultáneos no eludan el límite. */
  async consumeDailyUse(jid, limit) {
    const today = new Date().toISOString().slice(0, 10);
    return this.mutate((state) => {
      const user = getUserFromState(state, jid);
      if (user.daily?.day !== today) user.daily = { day: today, used: 0 };
      if (user.daily.used >= limit) return { allowed: false, remaining: 0, used: user.daily.used };
      user.daily.used += 1;
      return { allowed: true, remaining: Math.max(0, limit - user.daily.used), used: user.daily.used };
    });
  }
}

function getUserFromState(state, jid) {
  if (!state.users || typeof state.users !== 'object') state.users = {};
  if (!state.users[jid]) {
    state.users[jid] = { daily: { day: '', used: 0 }, model: '', imageModel: '', history: [] };
  }
  const user = state.users[jid];
  if (!Array.isArray(user.history)) user.history = [];
  return user;
}
