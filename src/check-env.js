import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
const isTemplate = (value) => /^(pega_tu_clave_aqui|your_api_key|<your_aimlapi_key>|<your_eden_ai_api_key>)$/i.test(String(value || '').trim());
const firstConfigured = (values) => values.find(([, value]) => String(value || '').trim() && !isTemplate(value));
const aiml = firstConfigured([
  ['AIMLAPI_API_KEY', process.env.AIMLAPI_API_KEY],
  ['AIMLAPI_KEY', process.env.AIMLAPI_KEY],
  ['AI_ML_API_KEY', process.env.AI_ML_API_KEY],
]);
const eden = firstConfigured([
  ['EDENAI_API_KEY', process.env.EDENAI_API_KEY],
  ['EDEN_AI_API_KEY', process.env.EDEN_AI_API_KEY],
  ['EDEN_API_KEY', process.env.EDEN_API_KEY],
]);
const requested = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
const provider = requested === 'eden' ? 'eden' : requested === 'aimlapi' ? 'aimlapi' : eden ? 'eden' : 'aimlapi';
const configured = provider === 'eden' ? eden : aiml;

console.log(`Archivo .env: ${existsSync(envPath) ? 'encontrado' : 'no encontrado'} (${envPath})`);
console.log(`Proveedor seleccionado: ${provider === 'eden' ? 'Eden AI' : 'AI/ML API'}`);
if (configured) {
  // Nunca imprimimos la clave: solo confirmamos la variable que el bot utilizará.
  console.log(`Clave ${provider === 'eden' ? 'Eden AI' : 'AI/ML API'}: configurada mediante ${configured[0]} (oculta)`);
  process.exit(0);
}

console.error(`Clave ${provider === 'eden' ? 'Eden AI' : 'AI/ML API'}: no configurada.`);
console.error(provider === 'eden'
  ? 'Crea o edita .env y agrega: EDENAI_API_KEY=tu_clave_real'
  : 'Crea o edita .env y agrega: AIMLAPI_API_KEY=tu_clave_real');
console.error('No pongas un ejemplo <YOUR_API_KEY> ni el código JavaScript del endpoint en .env.');
process.exitCode = 1;
