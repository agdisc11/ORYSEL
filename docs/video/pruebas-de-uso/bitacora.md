# Bitácora de casos de uso · MOON DIAL

Registro de las pruebas de uso hechas sobre https://orysel.duckdns.org. Las ejecutó el asistente de IA (Claude) desde Chrome, con la sesión del equipo iniciada; las contraseñas siempre las escribió una persona del equipo. Horas en tiempo local (UTC−6).

**Estados:** ✅ pasó · ⚠️ pasó con observaciones · ❌ falló · ⏳ pendiente

---

## Ronda 0 · Revisión exploratoria del front

**15 nov 2026, 08:30 – 09:15 aprox.** · App en español · Antes de las correcciones de datos.

Se recorrieron todas las pantallas (Catálogo, Ficha en sus 4 vistas, Comparar, Acerca de los datos), ORY-Bot, el simulador y el modal de la API, y se revisó en el código de dónde salía cada número.

| Caso | Resultado | Hallazgo | Qué se hizo |
|---|---|---|---|
| Calcular un punto con "Coordenadas personalizadas" | ❌ | No calculaba: elegía el sitio más cercano del catálogo y decía que sí había calculado | Se creó la ruta `/api/compute`, que calcula con SPICE en el servidor (commit `a6820bf`) |
| Leer la ficha de IM-2 | ⚠️ | El texto decía "más del 99 %" de Tierra visible; el valor calculado es 73 % | Texto corregido (`a6820bf`) |
| Ver el horizonte de Shackleton | ❌ | Horizonte inventado y etiquetado como "LOLA" | Marcado como escenario hipotético con horizonte supuesto (`a6820bf`) |
| Ver la verificación en "Acerca de los datos" | ❌ | Mostraba un error RMS de 0.008° escrito a mano | Se mide de verdad: 0.000027° en 5,768 comparaciones (`a6820bf`) |
| Gráfica "Horizonte local y terreno" | ❌ | Dibujaba montañas con fórmulas aunque el cálculo usa horizonte liso | Ahora dibuja el horizonte real del cálculo (`a6820bf`) |
| Barras "Perspectiva de 24 horas" | ⚠️ | En realidad mostraban el mes completo | Reetiquetadas (`a6820bf`) |
| Simulador para niños | ⚠️ | La ruta pasaba por el Sol | El Sol queda lejos y las paradas son revisiones de la nave (`a6820bf`) |
| Cambiar a inglés | ⚠️ | Nombres y descripciones de sitios seguían en español | Traducidos (`a6820bf`) |

## Ronda 1 · Pruebas de uso grabadas

**15 nov 2026, 10:40 – 10:55** · App en inglés · Versión con ORY-Bot (commit `4b74ee8`) · Videos en esta carpeta.

| ID | Hora | Caso de uso | Resultado | Observaciones |
|---|---|---|---|---|
| P1 | 10:41 | Catálogo: buscar "reiner", filtrar por South polar y Not viable, abrir IM-2 | ✅ | Filtros y búsqueda correctos |
| P2 | 10:46 | Ficha de IM-2: vistas Specialist, Educator y Kids; Play; pestaña de eventos | ✅ | La reproducción avanza unas 6 h por segundo |
| P3 | 10:50 | Coordenadas: latitud 95 (inválida) y luego (26.13°, 3.63°) | ✅ | Con 95 sale el error y el botón se bloquea; el punto válido da 95 % GO en unos 3 s |
| P4 | 10:51 | Comparar: Shackleton como sitio C y retraso +4 días | ⚠️ | Las barras "Compare dates" estaban mal etiquetadas (ver H1) |
| P5 | 10:51 | ORY-Bot: abrir, ir a Shackleton desde el bot, ver el mensaje en Kids, minimizar | ✅ | El mensaje cambia según el sitio y la vista. **Video retirado:** el bot se quitó de la app (`456a38c`) |
| P6 | 10:52 | Simulador: Launch, Antenna, Moon, Lunar Orbit, Liftoff | ✅ | Sin errores |
| P7 | 10:53 | Idioma ES/EN, barra Mode, menú de cuenta | ✅ | El correo del menú se difuminó en el video |
| P8 | 10:55 | Acceso: cerrar sesión, formulario vacío, correo inválido, "Forgot password", "Sign up" | ⚠️ | La pantalla salió en español con la app en inglés (ver H2). La última captura no se grabó porque Chrome dejó de responder |

### Hallazgos de la ronda 1

| ID | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| H1 | En Comparar, las tres barras mostraban la luz solar de A, B y C, pero decían "Sunlight", "Earth link" y el nombre de C | Media (dato mal etiquetado) | ✅ Corregido en `3087ad8`: cada barra lleva el nombre de su sitio |
| H2 | Al cerrar sesión, la pantalla de acceso usaba el idioma del navegador y no el elegido en la app | Baja | ✅ Corregido en `3087ad8`: recuerda el último idioma |
| H3 | La tarjeta de veredicto de Comparar no cambia con el retraso | Baja | ⏳ Pendiente |
| H4 | El dibujo "Orbital position" pone al Sol y a la Tierra en la misma órbita alrededor de la Luna | Baja (puede confundir) | ⏳ Pendiente |
| H5 | En dos ocasiones Chrome dejó de producir capturas (después de exportar un GIF grande o de usar el simulador) | Herramienta de grabación, no de la app | Se recarga la pestaña y se repite |

### Cambios hechos después de la ronda 1

- `456a38c` · Se quitó ORY-Bot. "Acerca de los datos" ahora solo muestra las fuentes abiertas de la NASA y por qué son confiables (sin comité académico ni datos de AWS).
- `3087ad8` · Corrección de H1 y H2.

## Otras pruebas hechas (sin video)

| Fecha y hora | Prueba | Resultado |
|---|---|---|
| 15 nov, madrugada | API de cuentas por HTTPS: registro, correo repetido, contraseña corta, contraseña equivocada, sesión, cierre de sesión, límites | ✅ Todas las respuestas correctas; cuentas de prueba borradas |
| 15 nov, madrugada | Acceso obligatorio: sin sesión, todas las rutas de datos responden 401 | ✅ |
| 15 nov, 10:20 | Motor SPICE contra NASA JPL Horizons, 4 sitios, cada hora por 30 días | ✅ Diferencia máxima 0.000027° en 5,768 comparaciones |
| 15 nov, 10:25 | `/api/compute` por HTTPS: sin sesión, latitud 95, texto en lugar de número, punto válido | ✅ 401, 422, 422 y cálculo en 2.3 s |
| 14 nov | Diseño responsivo a 360, 375, 414, 480, 640, 768 y 1024 px, en las 4 pantallas y las 4 vistas | ✅ Sin desbordes horizontales |

## Ronda 2 · Pruebas de uso grabadas (sin ORY-Bot)

⏳ Pendiente. Se graba con el [guion de pruebas](guion-pruebas.md), versión 2, que cambia la P5 de ORY-Bot por "Acerca de los datos". Al terminar se llena esta tabla.

| ID | Hora | Caso de uso | Resultado | Observaciones |
|---|---|---|---|---|
| P1 | | Catálogo: búsqueda y filtros | ⏳ | |
| P2 | | Ficha: vistas de público y reproducción | ⏳ | |
| P3 | | Coordenadas personalizadas | ⏳ | |
| P4 | | Comparar con retraso (comprueba H1) | ⏳ | |
| P5 | | Acerca de los datos | ⏳ | |
| P6 | | Simulador para niños | ⏳ | |
| P7 | | Idioma, Mode y menú de cuenta | ⏳ | |
| P8 | | Acceso: validaciones (comprueba H2) | ⏳ | |
