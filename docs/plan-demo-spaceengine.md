# Plan de la demostración con SpaceEngine

Equipo ORYSEL · NASA Space Apps 2026 · Lunar Landing Site Navigator
Estado: borrador del sábado 14 de noviembre. Falta que el equipo resuelva las dudas de la sección 4.

**Regla que no cambia:** SpaceEngine se usa solo para mostrar. La app no lo necesita, no usa sus datos y no queda en la versión final. Todos los números salen de nuestra app (SPICE y datos abiertos de NASA).

## 1. Herramientas y recursos

| Herramienta | Para qué se usa | ¿Va en el producto final? |
|---|---|---|
| App web propia (React + TypeScript) | Lo que se entrega: catálogo, ficha del sitio, comparador | Sí |
| SPICE de NASA/NAIF con DE440 (dentro de la app) | Calcular dónde están el Sol y la Tierra vistos desde cada sitio | Sí |
| JPL Horizons | Comprobar nuestros cálculos | No, solo validación |
| LOLA / LROC (NASA) | Relieve, horizonte e imágenes de los sitios | Sí |
| **SpaceEngine** | Motor de simulación 3D para las demostraciones visuales: enseña la misma escena que la app calculó | **No, solo demostración** |
| Grabador de pantalla (OBS o el de Windows) | Video de respaldo de cada escena de SpaceEngine | No |

## 2. Flujo de la demostración

La idea de cada escena es la misma: **la app da el número y SpaceEngine lo enseña**. Nunca al revés.

| Momento | Qué se dice | Qué se ve en la app | Qué se ve en SpaceEngine |
|---|---|---|---|
| 0:00 a 0:10 | Una frase: qué es y para quién. Sin tablas ni fórmulas. | Portada | Nada |
| 0:10 a 0:40 | Elegimos un sitio del catálogo (IM-2, Mons Mouton) | Catálogo y ficha: 59 % del mes con Sol, 73 % con la Tierra a la vista | Nada |
| 0:40 a 1:05 | "Así se ve ese cielo desde el suelo" | La gráfica marca una fecha y hora | **Escena 1:** cámara parada en el sitio, a la misma fecha y hora. El Sol rasante a unos 2° y la Tierra baja sobre el horizonte |
| 1:05 a 1:25 | "Y aquí se pierde la comunicación" | Evento "la Tierra se oculta" con su hora | **Escena 2:** se acelera el tiempo y la Tierra baja hasta tocar el horizonte en esa misma hora |
| 1:25 a 1:45 | Comparamos con otro sitio | Comparador y veredicto | **Escena 3 (opcional):** vista desde órbita con los dos sitios y la línea día-noche |
| 1:45 a 2:00 | Cierre: datos de NASA, comprobado contra Horizons | Página "Acerca de los datos" | Nada |

Cómo se conecta con la explicación técnica:

- Escena 1 enseña **acimut y elevación**: los dos números de la ficha son la posición del Sol y la Tierra en ese cielo.
- Escena 2 enseña un **evento**: la hora que calculó la app es la hora en que la Tierra cruza el horizonte.
- Escena 3 enseña por qué los polos son especiales: el Sol nunca sube mucho y las sombras son largas.

Antes del pitch hay que comprobar cada escena: poner en SpaceEngine la fecha y hora de la app y ver que el Sol y la Tierra quedan donde dice la app. Si no coinciden, esa escena no se usa.

## 3. Logística para que no falle

**Preparación (antes del control de las 18:00)**

- Guardar cada escena como ubicación en SpaceEngine (posición, orientación de la cámara y fecha), con nombres "1-IM2-cielo", "2-IM2-ocaso-Tierra", "3-orbita". Los nombres de los menús cambian según la versión: comprobarlo en la laptop que se va a usar.
- Anotar en una tarjeta, por escena: coordenadas, fecha y hora UTC, y los números que debe mostrar la app.
- Dejar el tiempo en pausa al guardar. En la demo solo se usa una velocidad de tiempo, ya ensayada.
- Ocultar la interfaz de SpaceEngine durante la escena, para que no distraiga.
- Probar con el proyector de la sede: resolución, brillo (el polo lunar es muy oscuro) y cambio de ventana.
- SpaceEngine ya abierto y cargado antes de empezar. Nada de abrirlo en vivo.
- Laptop conectada a la corriente y sin notificaciones.

**Roles**

| Rol | Qué hace |
|---|---|
| Quien explica | Habla y mira al jurado. No toca la computadora. |
| Quien opera la app | Lleva el recorrido en el navegador. |
| Quien opera SpaceEngine | Solo carga las escenas guardadas y controla el tiempo. Puede ser la misma persona de la app si se ensaya el cambio de ventana. |
| Quien cuida el tiempo | Avisa en el minuto 1:30 y decide si se salta la escena 3. |

**Respaldo**

- Grabar cada escena en video (10 a 15 segundos) en cuanto quede bien. Si SpaceEngine falla o tarda más de 5 segundos, se pone el video y se sigue hablando.
- Tener también una captura fija de cada escena dentro de las diapositivas.
- Si la laptop de SpaceEngine no está, la demo se hace completa solo con la app. El guion no depende de SpaceEngine.

## 4. Revisión crítica: dudas y huecos

**Contradicción principal.** La retroalimentación del evaluador (documento "Optimización y claridad en la presentación", sección 4) pide lo contrario de este plan: reducir al mínimo las menciones a SpaceEngine y **no mostrar simulaciones 3D hechas con él**, porque el jurado se pregunta por qué no usar SpaceEngine directamente. Su checklist dice: "Excluir vistas 3D de Space Engine: limitarlo a una mención verbal". El equipo tiene que decidir cuál de estas tres opciones toma:

1. **Seguir al evaluador:** SpaceEngine no aparece en el pitch. Se usa solo por dentro para validar. Es la opción más segura.
2. **Punto medio (recomendada):** una sola escena de 15 a 20 segundos, ya grabada, presentada como "comprobación visual" y con el número de la app encima. Sin operar SpaceEngine en vivo.
3. **Este plan completo:** tres escenas en vivo. Es lo más vistoso y lo más arriesgado, y va contra el consejo recibido.

**Otros huecos**

- **La entrega oficial no es la demo en vivo.** A los jueces globales les llegan 7 diapositivas o un video de 30 segundos. En 30 segundos casi no cabe SpaceEngine sin quitarle tiempo a la app.
- **Licencia y créditos.** SpaceEngine es un programa de pago y no es de NASA. Falta revisar si su licencia permite usar capturas y video en una entrega pública, y cómo se le da crédito. En el formulario va en "otras referencias", no en "datos de NASA".
- **Precisión.** SpaceEngine no usa nuestros kernels. Puede diferir de la app en décimas de grado y su relieve no es el de LOLA. Con el Sol a 2° del horizonte, una diferencia pequeña cambia si se ve o no. Por eso cada escena se comprueba antes y se elige un momento donde la diferencia no se note.
- **Cuello de botella.** Solo una laptop tiene SpaceEngine. Si esa persona también programa, las escenas le quitan horas de desarrollo. Hay unas 12 horas útiles por persona.
- **Lo que pide el segundo documento** (comunicación como filtro de selección, trabajos futuros) no necesita SpaceEngine: sale de la métrica "Tierra a la vista" que la app ya calcula.

**Dudas para el equipo**

1. ¿Cuál de las tres opciones de arriba toman?
2. ¿Qué versión de SpaceEngine tienen y en qué laptop? ¿Esa laptop es la que se conecta al proyector?
3. ¿Quién opera SpaceEngine y quién explica?
4. ¿Las escenas son solo para la sede (controles y panel del domingo) o también quieren meterlas en el video o las diapositivas de la entrega?
5. ¿Qué sitios se muestran además de IM-2?
6. El evaluador habla de un prototipo con registro de cuentas y un asistente ("robotito"). ¿Eso entra en la demo? No está en el plan de las siete partes.

**Cuidado con el segundo documento.** Recomienda decir en el pitch que se aplican ecuaciones de Euler-Lagrange, modelos gaussianos, la exosfera y nubes de polvo, y citar a profesores como asesores. La app no hace nada de eso. Decirlo como si ya estuviera hecho baja la nota de Validez si un juez pregunta. Lo honesto es ponerlo en "trabajo futuro" y citar solo a quien de verdad asesoró.
