# Guion de las pruebas de uso · MOON DIAL

Versión 2 · 15 de noviembre de 2026 · para la segunda ronda de grabación.

## Cómo se graban

- **Sitio:** https://orysel.duckdns.org, con la sesión iniciada y la app en inglés (EN).
- **Equipo:** Chrome en Windows, ventana de escritorio (1707 × 769 px de área visible).
- **Grabación:** la extensión de Chrome capta un cuadro en cada acción, marca el clic con un círculo naranja y pone una etiqueta con lo que se hizo. Después se convierte a MP4. No lleva audio; la columna "Narración" es para grabar la voz después.
- **Datos que se escriben:** solo los de esta tabla. Nunca se escribe una contraseña real.
- **Privacidad:** si aparece el correo de la cuenta, se difumina en el video.

| # | Prueba | Duración aprox. |
|---|---|---|
| P1 | Catálogo: búsqueda y filtros | 25 s |
| P2 | Ficha del sitio: vistas de público y reproducción | 25 s |
| P3 | Coordenadas personalizadas | 20 s |
| P4 | Comparar sitios con retraso | 20 s |
| P5 | Acerca de los datos | 15 s |
| P6 | Simulador para niños | 20 s |
| P7 | Idioma, barra "Mode" y menú de cuenta | 20 s |
| P8 | Pantalla de acceso: validaciones | 25 s |

---

## P1 · Catálogo: búsqueda y filtros

**Objetivo:** encontrar un sitio por nombre y filtrar el catálogo por región y por veredicto.
**Antes de empezar:** pestaña Catalog, sin filtros, arriba de la página.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | Escribir `reiner` en "Search landing sites" | Queda solo Reiner Gamma | "Busco un sitio por su nombre." |
| 2 | Borrar la búsqueda | Vuelven los 4 sitios | |
| 3 | Clic en Region › South polar | Quedan IM-2 y Shackleton | "Puedo filtrar por región…" |
| 4 | Clic en Verdict › Not viable | Queda solo Shackleton | "…y por veredicto: este sitio no es viable." |
| 5 | Clic en All (región) y All (veredicto) | Vuelven los 4 sitios | |
| 6 | Clic en "Open site" de IM-2 | Se abre la ficha de IM-2 | "Abro IM-2 para ver su ficha." |

## P2 · Ficha del sitio: vistas de público y reproducción

**Objetivo:** ver los mismos datos para cuatro públicos y mover el tiempo.
**Antes de empezar:** ficha de IM-2 en vista General, arriba.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | Clic en Specialist | Cuentas regresivas, puntuación y desglose | "La vista para especialistas muestra los números completos." |
| 2 | Bajar a la gráfica "Sun and Earth Elevation" | Gráfica de un mes y ventanas de luz y Tierra | |
| 3 | Clic en Play, esperar 3 s | El cursor avanza por el mes; cambian los ángulos | "Con Play veo moverse al Sol y la Tierra durante el mes." |
| 4 | Clic en Pause | Se detiene | |
| 5 | Clic en la pestaña "Rise & Set Horizon Events" | Tabla con 5 salidas y puestas, al segundo | "Cada salida y puesta está calculada al segundo." |
| 6 | Subir y clic en Educator | Tarjetas que explican acimut, libración y exosfera | "La vista para educadores lo explica." |
| 7 | Clic en Kids | Pregunta "¿Es un buen lugar para explorar?" y 3 reglas | "Y la de niños lo dice con sí o no." |
| 8 | Clic en General | Vuelve la vista general | |

## P3 · Coordenadas personalizadas

**Objetivo:** calcular un punto cualquiera de la Luna y comprobar que la app rechaza valores imposibles.
**Antes de empezar:** pestaña Catalog, bajar hasta "Custom coordinates".

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | En Latitude escribir `95` | Mensaje de error y botón desactivado | "Si la latitud no existe, la app lo avisa." |
| 2 | Corregir Latitude a `26.13` y Longitude a `3.63` | Desaparece el error | |
| 3 | Clic en "+ Compute site" | Aparece "Computing…" | "Escribo un punto y el servidor lo calcula con SPICE." |
| 4 | Esperar unos 3 s | Se abre la ficha "Custom point (26.13°, 3.63°)" con su puntuación | "En unos segundos tengo su ficha completa." |

## P4 · Comparar sitios con retraso

**Objetivo:** poner tres sitios lado a lado y ver qué pasa si se retrasa el alunizaje.
**Antes de empezar:** pestaña Compare, arriba. Sitio A: IM-2, B: Reiner Gamma, C vacío.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | En el sitio C elegir Shackleton | Aparece la tercera Luna con 0 % | "Agrego un tercer sitio." |
| 2 | Clic dos veces en "+" del retraso | Retraso +4 días; la tabla cambia | "Si retraso el alunizaje cuatro días, cambian los porcentajes." |
| 3 | Bajar a la tabla y a "Sunlight with the delay" | Cada barra lleva el nombre de su sitio (A, B, C) | "Aquí veo la luz solar de cada sitio con ese retraso." |
| 4 | Bajar a "What if we delay?" | Control deslizante en 4 días | |

## P5 · Acerca de los datos

**Objetivo:** ver de dónde vienen los datos y por qué son confiables.
**Antes de empezar:** pestaña About data, arriba.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | Abrir About data | Lista de 4 fuentes abiertas de la NASA con enlaces | "Todos los datos son abiertos y gratuitos de la NASA." |
| 2 | Bajar a "Why they are reliable" | 4 razones y la franja 0.000027° · 5,768 comparaciones | "Y están comprobados contra JPL Horizons." |

## P6 · Simulador para niños

**Objetivo:** usar el simulador de la nave.
**Antes de empezar:** ficha de IM-2 en vista Kids, bajar hasta el simulador.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | Clic en Launch | La nave va al punto de despegue, junto a la Tierra | "Despegamos desde la Tierra." |
| 2 | Clic en "1 · Antenna" | La nave llega a la revisión de la antena | "Primero revisamos que la antena apunte a la Tierra…" |
| 3 | Clic en "2 · Panels" | La nave llega a la revisión de los paneles | "…y que los paneles reciban luz del Sol." |
| 4 | Clic en "3 · Moon" | La nave llega a la Luna | "Y llegamos a la Luna." |
| 5 | Clic en "🚀 Liftoff!" | Aparece "Liftoff to the Moon!" | |

## P7 · Idioma, barra "Mode" y menú de cuenta

**Objetivo:** cambiar de idioma, ver la explicación de cada vista y usar el menú de cuenta.
**Antes de empezar:** ficha de IM-2 en vista General, arriba.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | Clic en ES | Toda la app pasa a español, nombres de sitios incluidos | "La app está en español…" |
| 2 | Clic en EN | Vuelve al inglés | "…y en inglés." |
| 3 | Clic en "? Mode" | Barra que explica la vista actual y botones de público | "Mode explica qué muestra cada vista." |
| 4 | Clic otra vez en "? Mode" | Se cierra la barra | |
| 5 | Clic en el avatar | Menú con nombre, correo (difuminado) y "Sign out" | "Desde aquí se cierra la sesión." |
| 6 | Tecla Esc | Se cierra el menú | |

## P8 · Pantalla de acceso: validaciones

**Objetivo:** comprobar que el acceso es obligatorio y que el formulario avisa de los errores.
**Antes de empezar:** app en inglés; abrir el menú de cuenta y clic en "Sign out". La grabación empieza ya en la pantalla de acceso.

| Paso | Acción | Resultado esperado | Narración |
|---|---|---|---|
| 1 | (Sin escribir nada) clic en "Sign in" | Aparece en inglés; errores bajo correo y contraseña | "Sin cuenta no se entra a la app." |
| 2 | En Email escribir `correo-sin-arroba` y clic en "Sign in" | Error de correo inválido | "Si el correo está mal escrito, lo avisa." |
| 3 | Clic en "Forgot your password?" | Nota sobre cómo recuperar la cuenta | |
| 4 | Clic en "Sign up" | Formulario con nombre, correo, contraseña y confirmación | "Crear una cuenta pide nombre, correo y una contraseña de 8 caracteres o más." |
| 5 | Clic en "Create account" sin llenar | Errores en nombre, correo y contraseña | |
| 6 | Clic en "Sign in" (enlace de abajo) | Vuelve al formulario de acceso | |

**Al terminar:** alguien del equipo inicia sesión de nuevo con su cuenta. El asistente no escribe contraseñas.
