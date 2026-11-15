# Pruebas de uso · MOON DIAL

Fecha: 15 de noviembre de 2026 · Sitio: https://orysel.duckdns.org (app en inglés) · Navegador: Chrome en Windows, pantalla de escritorio.

Cada video muestra la pantalla de la app mientras se hace la tarea. El círculo naranja marca cada clic, la etiqueta negra dice qué se hizo y la barra de abajo indica el avance. Los videos no tienen audio: la voz se agrega después. En la esquina aparece la marca de la extensión que los grabó, que es una herramienta de IA.

| Video | Tarea | Resultado |
|---|---|---|
| `prueba-1-catalogo.mp4` | Buscar "reiner", filtrar por Polo sur y por No viable, quitar filtros y abrir IM-2 | ✅ Funciona: la búsqueda y los filtros muestran los sitios correctos |
| `prueba-2-ficha-vistas.mp4` | Abrir la ficha de IM-2, cambiar a Especialista, reproducir el tiempo, abrir la pestaña de eventos y pasar por Educador y Niños | ✅ Funciona: las cuatro vistas cambian y la reproducción avanza |
| `prueba-3-coordenadas.mp4` | Escribir una latitud inválida (95) y luego un punto válido (26.13°, 3.63°) y calcular | ✅ Funciona: con 95 aparece el error y el botón se bloquea; el punto válido se calcula en unos 3 s y abre su ficha |
| `prueba-4-comparar.mp4` | Poner Shackleton como sitio C, aumentar el retraso a +4 días y revisar los resultados | ⚠️ Funcionaba con un error en las etiquetas (abajo); ya corregido |
| `prueba-6-simulador.mp4` | En la vista Niños: despegar, ir a la antena, ir a la Luna, cambiar a órbita y "Liftoff" | ✅ Funciona |
| `prueba-7-idioma-cuenta.mp4` | Cambiar a español y volver a inglés, abrir la barra "Mode", abrir y cerrar el menú de cuenta | ✅ Funciona. El correo del menú de cuenta está difuminado en el video |
| `prueba-8-login.mp4` | Cerrar sesión, enviar el formulario vacío, escribir un correo inválido, ver "¿Olvidaste tu contraseña?" y pasar a "Crear cuenta" | ⚠️ Funcionaba con un detalle de idioma (abajo); ya corregido |

La prueba 5 (ORY-Bot) se eliminó porque el asistente se quitó de la app.

## Problemas encontrados y su estado

1. **Comparar · barras mal etiquetadas.** El bloque "Compare dates" mostraba la luz solar de los sitios A, B y C, pero las barras decían "Sunlight", "Earth link" y el nombre de C. La de "Earth link" mostraba en realidad la luz de Reiner Gamma. **Corregido:** el bloque ahora se llama "Luz solar con el retraso" y cada barra lleva el nombre de su sitio.
2. **El login no respetaba el idioma elegido.** Al cerrar sesión con la app en inglés, la pantalla de acceso salía en español porque usaba el idioma del navegador. **Corregido:** ahora usa el último idioma elegido en la app.
3. **Comparar · el veredicto no cambia con el retraso.** La tarjeta "Viability verdict" sigue mostrando la puntuación de la ventana completa aunque se mueva el retraso. **Pendiente:** conviene aclararlo en la tarjeta o recalcularla.
4. **Comparar · "Posición orbital".** El dibujo pone al Sol y a la Tierra sobre la misma órbita alrededor de la Luna. Es solo ilustrativo y puede confundir. **Pendiente:** etiquetarlo como esquema o quitarlo.

## Lo que no se probó

- **Iniciar sesión y crear una cuenta con contraseña real:** el asistente no escribe contraseñas en sitios en producción. Eso lo probó el equipo a mano, y la API se probó por separado.
- **Celular y tableta:** se revisaron antes con capturas, pero no hay video. Para grabarlo se puede usar el celular con su grabador de pantalla.
- **Algunos videos muestran el botón de ORY-Bot en una esquina,** porque se grabaron antes de quitarlo. Se pueden volver a grabar si hace falta.
