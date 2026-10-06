# Modelos del proveedor activo

Esta carpeta maneja todos los modelos del catálogo vivo del proveedor elegido:

- **AI/ML API:** `https://api.aimlapi.com/v1/models`
- **Eden AI:** `https://api.edenai.run/v3/models`

Comandos:

- `.models` muestra los primeros modelos de texto.
- `.models image` muestra modelos de imagen.
- `.models all` entrega todo el catálogo disponible en varias respuestas si es necesario.
- `.model <id>` selecciona cualquier modelo de chat compatible.
- `.imagemodel <id>` selecciona un modelo de imagen compatible.

No se mantienen IDs hardcodeados: así los nuevos modelos quedan disponibles sin actualizar archivos. Eden usa IDs como `google/gemini-2.5-flash` para chat e `image/generation/minimax` para imagen.
