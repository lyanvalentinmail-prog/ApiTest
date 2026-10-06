import { AimlApiError } from './aimlapi.js';

const DEFAULT_BASE_URL = 'https://api.edenai.run/v3';

/** Cliente de Eden AI V3: chat OpenAI-compatible, catálogo y generación de imagen. */
export class EdenAiClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL }) {
    if (!apiKey || /^(pega_tu_clave_aqui|your_api_key|<your_eden_ai_api_key>)$/i.test(String(apiKey).trim())) {
      throw new Error('No encontré una clave de Eden AI. Agrega EDENAI_API_KEY=tu_clave_real en .env.');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.modelsCache = null;
    this.modelsCacheExpiresAt = 0;
  }

  async request(path, { method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }
      if (!response.ok) {
        throw new AimlApiError(`Eden AI (${response.status}): ${extractError(data) || response.statusText || 'Solicitud rechazada.'}`, response.status);
      }
      if (data?.status === 'fail') {
        throw new AimlApiError(`Eden AI: ${extractError(data) || 'El proveedor no pudo completar la solicitud.'}`);
      }
      return data;
    } catch (error) {
      if (error instanceof AimlApiError) throw error;
      if (error?.name === 'AbortError') throw new AimlApiError('Eden AI tardó demasiado en responder. Inténtalo de nuevo.');
      throw new AimlApiError(`No se pudo conectar con Eden AI: ${error.message || 'error de red'}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat({ model, messages, temperature = 0.7, maxTokens = 900 }) {
    const data = await this.request('/chat/completions', {
      method: 'POST',
      body: { model, messages, temperature, max_tokens: maxTokens },
    });
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content.map((part) => (typeof part === 'string' ? part : part?.text || '')).filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    throw new AimlApiError('Eden AI no devolvió texto para este modelo. Prueba otro con .model <id>.');
  }

  async generateImage({ model, prompt }) {
    const data = await this.request('/universal-ai', {
      method: 'POST',
      body: { model, input: { text: prompt } },
    });
    const output = data?.output || data;
    const url = output?.image_resource_url || output?.url || output?.image_url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return { url };
    const image = output?.image || output?.b64_json || output?.image_base64;
    if (typeof image === 'string' && image.length > 64) {
      return { buffer: Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64') };
    }
    throw new AimlApiError('Eden AI no devolvió una imagen utilizable. Prueba otro modelo de imagen con .imagemodel <id>.');
  }

  async listModels({ force = false } = {}) {
    if (!force && this.modelsCache && Date.now() < this.modelsCacheExpiresAt) return this.modelsCache;
    const data = await this.request('/models');
    const models = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    if (!models.length) throw new AimlApiError('No se pudo leer el catálogo de modelos de Eden AI.');
    this.modelsCache = models;
    this.modelsCacheExpiresAt = Date.now() + 5 * 60_000;
    return models;
  }
}

function extractError(data) {
  const message = data?.error?.message || data?.error?.detail || data?.message || data?.detail || data?.raw;
  return typeof message === 'string' ? message.replace(/\s+/g, ' ').slice(0, 500) : '';
}
