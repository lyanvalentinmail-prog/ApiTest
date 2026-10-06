import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
const values = [
  ['AIMLAPI_API_KEY', process.env.AIMLAPI_API_KEY],
  ['AIMLAPI_KEY', process.env.AIMLAPI_KEY],
  ['AI_ML_API_KEY', process.env.AI_ML_API_KEY],
];
const isTemplate = (value) => /^(pega_tu_clave_aqui|your_api_key|<your_aimlapi_key>)$/i.test(String(value || '').trim());
const configured = values.find(([, value]) => String(value || '').trim() && !isTemplate(value));

console.log(`Archivo .env: ${existsSync(envPath) ? 'encontrado' : 'no encontrado'} (${envPath})`);
if (configured) {
  // Nunca imprimimos la clave: solo confirmamos la variable que el bot utilizará.
  console.log(`Clave AI/ML API: configurada mediante ${configured[0]} (oculta)`);
  process.exit(0);
}

console.error('Clave AI/ML API: no configurada.');
console.error('Crea o edita .env y agrega exactamente: AIMLAPI_API_KEY=tu_clave_real');
console.error('No pongas el ejemplo <YOUR_AIMLAPI_KEY>, ni el código JavaScript del endpoint, en .env.');
process.exitCode = 1;
