const DEFAULT_BASE_URL = 'https://api.aimlapi.com/v1';

export class AimlApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'AimlApiError';
    this.status = status;
  }
}

/** Cliente pequeño para los endpoints OpenAI-compatibles de AI/ML API. */
export class AimlApiClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL }) {
    if (!apiKey || /^(pega_tu_clave_aqui|your_api_key|<your_aimlapi_key>)$/i.test(String(apiKey).trim())) {
      throw new Error('No encontré una clave de AI/ML API. En la carpeta del proyecto crea .env con: AIMLAPI_API_KEY=tu_clave_real. Ejecuta npm run check:env para comprobarla sin mostrarla.');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.modelsCache = null;
    this.modelsCacheExpiresAt = 0;
  }

  async request(path, { method = 'GET', body, authenticated = true } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const headers = { Accept: 'application/json' };
      if (authenticated) headers.Authorization = `Bearer ${this.apiKey}`;
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
        const detail = extractApiError(data) || response.statusText || 'Solicitud rechazada.';
        throw new AimlApiError(`AI/ML API (${response.status}): ${detail}`, response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof AimlApiError) throw error;
      if (error?.name === 'AbortError') {
        throw new AimlApiError('AI/ML API tardó demasiado en responder. Inténtalo de nuevo.');
      }
      throw new AimlApiError(`No se pudo conectar con AI/ML API: ${error.message || 'error de red'}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat({ model, messages, temperature = 0.7, maxTokens = 900 }) {
    const data = await this.request('/chat/completions', {
      method: 'POST',
      body: {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      },
    });
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => (typeof part === 'string' ? part : part?.text || ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (joined) return joined;
    }
    throw new AimlApiError('La API no devolvió texto para este modelo. Prueba con otro usando .model <id>.');
  }

  async generateImage({ model, prompt }) {
    // Solo los campos universales: cada modelo de imagen acepta opciones distintas.
    const data = await this.request('/images/generations', {
      method: 'POST',
      body: { model, prompt },
    });
    const image = extractImage(data);
    if (!image) {
      throw new AimlApiError('La API no devolvió una imagen utilizable. Cambia el modelo con .imagemodel <id>.');
    }
    return image;
  }

  /** El catálogo real evita mantener IDs de modelos obsoletos en el bot. */
  async listModels({ force = false } = {}) {
    if (!force && this.modelsCache && Date.now() < this.modelsCacheExpiresAt) {
      return this.modelsCache;
    }
    const data = await this.request('/models?include=capabilities', { authenticated: false });
    const models = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    if (!models.length) throw new AimlApiError('No se pudo leer el catálogo de modelos de AI/ML API.');
    this.modelsCache = models;
    this.modelsCacheExpiresAt = Date.now() + 5 * 60_000;
    return models;
  }
}

function extractApiError(data) {
  const detail = data?.error?.message || data?.error?.detail || data?.message || data?.detail || data?.raw;
  return typeof detail === 'string' ? detail.replace(/\s+/g, ' ').slice(0, 500) : '';
}

function extractImage(data) {
  const groups = [
    data?.data,
    data?.images,
    data?.output?.choices,
    data?.output?.data,
    data?.result?.data,
  ].filter(Array.isArray);

  for (const group of groups) {
    for (const item of group) {
      if (typeof item === 'string' && /^https?:\/\//i.test(item)) return { url: item };
      if (!item || typeof item !== 'object') continue;
      const url = item.url || item.image_url || item.imageUrl || item.uri;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) return { url };
      const base64 = item.b64_json || item.image_base64 || item.base64;
      if (typeof base64 === 'string' && base64.length > 64) {
        return { buffer: Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64') };
      }
    }
  }
  return null;
}

export function modelCapabilities(model) {
  const raw = model?.capabilities;
  return Array.isArray(raw) ? raw.join(', ') : typeof raw === 'object' ? JSON.stringify(raw) : String(raw || '');
}

export function isProbablyImageModel(model) {
  const fingerprint = `${model?.id || ''} ${modelCapabilities(model)}`.toLowerCase();
  return /text[_ -]?to[_ -]?image|image[_ -]?generation|image_generation|dall[ -]?e|flux|stable[- ]diffusion|imagen|seedream|grok[- ]imagine|image-o1/.test(fingerprint);
}

/** Descarta modalidades que no aceptan /chat/completions sin esconder LLMs nuevos del catálogo. */
export function isProbablyChatModel(model) {
  const fingerprint = `${model?.id || ''} ${modelCapabilities(model)}`.toLowerCase();
  if (/embedding|rerank|moderation|speech[_ -]?to[_ -]?text|text[_ -]?to[_ -]?speech|transcription|whisper|(^|[/_-])tts([/_-]|$)|text[_ -]?to[_ -]?video|image[_ -]?to[_ -]?video/.test(fingerprint)) {
    return false;
  }
  if (isProbablyImageModel(model) && !/chat|completion|text[_ -]?generation|multimodal/.test(fingerprint)) {
    return false;
  }
  return true;
}

export function resolveModel(models, requestedId) {
  const target = String(requestedId || '').trim().toLowerCase();
  if (!target) return null;
  return models.find((model) => {
    const names = [model.id, ...(Array.isArray(model.aliases) ? model.aliases : [])];
    return names.some((name) => String(name).toLowerCase() === target);
  }) || null;
}
