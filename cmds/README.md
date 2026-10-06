# Comandos del bot

Cada carpeta agrupa un tipo de IA o función:

- `ai/`: modelos de texto (chat, preguntas y gramática).
- `image/`: generación de imágenes.
- `models/`: catálogo vivo y selección de modelos AI/ML API.
- `system/`: menú y control de contexto.

Los modelos no se guardan como una lista fija de archivos: AI/ML API los actualiza constantemente. El comando `.models all` consulta y entrega el catálogo vivo completo, y `.model <id>` / `.imagemodel <id>` permiten elegir cualquier modelo compatible del catálogo.

Para agregar un comando, crea un módulo que exporte `name`, `category`, `usage`, `description` y `execute`, e impórtalo en `cmds/index.js`. Automáticamente aparecerá en `.menu`.
