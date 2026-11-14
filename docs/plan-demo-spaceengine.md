# Plan de Trabajo, Arquitectura y Guion de Demostración (ORYSEL + Validación Visual 3D en SpaceEngine)

**Equipo ORYSEL · NASA Space Apps 2026 · Lunar Landing Site Navigator (Sede Tuxtla Gutiérrez)**

> **Directriz Estratégica de Blindaje ante Mentores y Jurado:**
> **ORYSEL** (`web/src/App.tsx` + nuestro Kernel Físico SPICE/DE440 en `web/src/ephemeris/`) es el **protagonista absoluto y único motor de cálculo**.
> **SpaceEngine** **nunca** se presenta como el producto ni como fuente de datos: entra exclusivamente en un bloque acotado de **30 a 35 segundos** denominado **"Cápsula de Validación Visual y Contraste Físico 3D"** para corroborar ópticamente las coordenadas, sombras y líneas de visión que nuestro algoritmo ya dictaminó.

---

## 1. Integración Estratégica de Herramientas y Rol en la Arquitectura

| Componente / Herramienta | Rol Técnico en ORYSEL | ¿Forma parte del producto entregable? |
| :--- | :--- | :--- |
| **Frontend React + Vite (`web/src/`)** | Interfaz en **3 perfiles** (Profesional NASA, Educativa, Infantil/Gamificada), optimizada a **60 FPS** en el cliente, con asistente virtual (**ORY-Bot**) y simulador de vectores en cohete. | **Sí (Capa 1)** |
| **Backend Cloud AWS (`pruebas/bd-nasa/`, FastAPI/PostgreSQL + JSON Edge)** | APIs abiertas e integrables por terceros con baja latencia (**Ping optimizado**) para descargas continuas y datasets precalculados (`web/public/data/*.json`). | **Sí (Capa 2)** |
| **Kernel Físico y Geométrico (`web/src/ephemeris/`)** | Módulos `spice.ts` (`timecraftjs` DE440), `geometry.ts`, `events.ts`, `report.ts` y `types.ts`. Calcula acimut, elevación, velocidades orbitales/escape y el **KPI de Viabilidad**. | **Sí (Capa 3)** |
| **NASA JPL Horizons (`descargar_horizons.py`, `horizons.ts`)** | Validación astronómica cruzada con precisión $< 0.00003^\circ$. | **Sí (Validación científica)** |
| **SpaceEngine (3D)** | **Gemelo óptico de corroboración visual (35 s):** muestra en 3D la escena exacta (coordenadas y época UTC) que `report.ts` ya calculó. | **No (Solo contraste visual en demo)** |

---

## 2. Recorrido de Usuario (User Journey) y Triple Segmentación en `App.tsx`

### A. Apertura de Alto Impacto (0:00 a 0:10)
Antes de mostrar cualquier ecuación o gráfica, el pitch abre con una definición contundente de una sola frase:
> *"En la exploración lunar, aterrizar a ciegas cuesta cientos de millones de dólares: perder la línea de visión con la Tierra o con el satélite orbital durante el descenso significa perder la misión. **ORYSEL** es la plataforma de inteligencia orbital que predice matemáticamente dónde, cuándo y con qué probabilidad de éxito puede alunizar y comunicarse una misión antes de lanzar un solo kilogramo al espacio."*

### B. Recorrido Paso a Paso en la Interfaz Web
1. **Paso 1 — Registro y Creación de Cuenta (`OnboardingModal.tsx`):** El usuario registra su nombre, institución y elige su perfil operativo (`Profesional`, `Educativo` o `Infantil`).
2. **Paso 2 — Exploración de Sitios Recomendados (`sites.ts` + `public/data/*.json`):**
   - **IM-2 Athena (Mons Mouton — `im2.json`):** Meseta polar sur con Sol rasante y alta visibilidad terrestre.
   - **Reiner Gamma (`reiner-gamma.json`):** Remolino lunar ecuatorial con anomalía magnética cortical (~28 nT), topografía llana y visibilidad óptima (**KPI ~89% GO**).
   - **Cráter Shackleton Interior (`shackleton-blindspot.json`):** Depresión polar con muralla topográfica de $10^\circ\text{–}12^\circ$ que demuestra el **descarte automático por punto ciego** (**KPI ~19% NO-GO**).
   - **Mare Tranquillitatis (`apollo11.json`):** Referencia histórica de control.
3. **Paso 3 — Consulta de Viabilidad Guiada por el Asistente Virtual (`OryBotAssistant.tsx`):** Nuestro asistente ("robotito" **ORY-Bot**) interpreta los resultados de `report.ts`, alerta si se pierde el enlace con la tripulación o la cámara del satélite orbital y recomienda el sitio óptimo.

### C. KPI de Viabilidad + Filtro Determinante de Comunicación y Visibilidad Fotográfica
En `web/src/ephemeris/report.ts`, la función `computeViabilityKPI()` integra `geometry.ts`, `events.ts` y `ElevationChart.tsx`:
- Evalúa cuatro dimensiones: **Iluminación Solar (30%)**, **Enlace y Telemetría (35%)**, **Acimut y Topografía (20%)** y **Ambiente Lunar (15%)**.
- **Compuerta de Veto Determinante ($\Gamma_{\text{LoS}}$):** Si el sitio pierde el enlace directo de comunicación con la tripulación o carece de **Línea de Visión Directa (LoS) con el satélite orbital para confirmación fotográfica**, el algoritmo activa `blindSpotDetected = true` y descarta el sitio (`NO-GO (BLIND SPOT)`), evitando puntos ciegos.

### D. Triple Segmentación del Frontend
1. **Vista Profesional (NASA / Mecánica Orbital):** Panel técnico conectado a `report.ts` y `ElevationChart.tsx` con ángulos acimutales, velocidad circular de inserción ($1.68\text{ km/s}$), velocidad de escape/salida ($2.38\text{ km/s}$), elipse de dispersión gaussiana $3\sigma$ y tabla de eventos.
2. **Vista Educativa:** Tarjetas interactivas que explican acimut, elevación, libración lunar y anomalías magnéticas sin saturación matemática.
3. **Vista Infantil / Gamificada (`RocketVectorPlayground.tsx`):** Traduce el porcentaje del KPI en un veredicto binario (**"¡SÍ SE PUEDE ALUNIZAR!"** vs. **"¡NO SE PUEDE!"**) e incluye un simulador interactivo con **flechas vectoriales de velocidad** sobre un cohete para experimentar cuándo aluniza, cuándo entra en órbita lunar y cuándo escapa al espacio profundo.

---

## 3. Defensa de Arquitectura en 3 Capas, AWS, Ambiente Lunar y Blindaje Académico

### Arquitectura en 3 Capas y Despliegue en AWS
- **Capa 1 (Frontend Cliente — 60 FPS):** Renderizado ligero en React + Vite con SVG vectorial memorizado (`useMemo`) para cuidar los **FPS en el cliente** sin bloquear el navegador.
- **Capa 2 (Backend en AWS — APIs Abiertas y Bajo Ping):** Desplegado en AWS (PostgreSQL cargado con `cargar.sql` + distribución de JSON precalculados), exponiendo **APIs abiertas e integrables por terceros** (universidades y agencias) que cuidan la **latencia (Ping)** en descargas continuas.
- **Capa 3 (Kernel Físico — `web/src/ephemeris/`):** Cinemática espacial y marcos de referencia (`MOON_ME`) con NASA NAIF SPICE (`timecraftjs`).

### Modelado Ambiental Lunar y Hoja de Ruta (*Future Work*)
- **Exosfera Lunar (~2 km):** Interacción de la tenue capa límite superficial con los penachos de descenso.
- **Levantamiento Electrostático de Nubes de Regolito:** Polvo en levitación por tormentas solares y radiación UV en el terminador lunar que degrada paneles solares y enlaces de radiofrecuencia.
- **Anomalías Magnéticas Locales (Reiner Gamma ~28 nT):** Mini-magnetosferas corticales que deflectan parcialmente el viento solar.

### Lenguaje Matemático y Respaldo del Comité de Mentores / Asesores
- **Propagadores Orbitales y Estabilidad:** Basados en **Leyes de Kepler**, ecuaciones variacionales de **Euler-Lagrange** para perturbaciones gravitacionales y **distribuciones gaussianas** para el modelo probabilístico de alunizaje.
- **Respaldo Académico Multidisciplinario:**
  - **Dr. Horacio:** Programación, estructura de datos y arquitectura del Kernel (`src/ephemeris/`).
  - **Prof. Jorge y Dr. Manuel Martínez:** Electrónica, telemetría espacial y presupuesto de enlace (Link Budget / LoS).
  - **Dr. Mendoza y Dr. Montero:** Física teórica, estabilidad dinámica (Euler-Lagrange) y modelos probabilísticos gaussianos.

---

## 4. Guion Minuto a Minuto del Pitch + Demo Sincronizada (5 Minutos)

| Tiempo | Qué dice el Expositor | Qué se muestra en ORYSEL Web (`App.tsx`) | Qué se muestra en SpaceEngine |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:10** | **Gancho de Apertura:** *"En la exploración lunar, aterrizar a ciegas cuesta cientos de millones: perder línea de visión durante 15 minutos significa perder la misión. ORYSEL predice dónde, cuándo y con qué viabilidad puede alunizar y comunicarse una misión antes de lanzar un solo kilogramo."* | Portada principal de ORYSEL (`pitch-hero`) limpia, sin saturar con tablas ni fórmulas. | Nada (en segundo plano). |
| **0:10 – 0:35** | **Paso 1 (Cuenta) y Paso 2 (Catálogo):** *"Creamos nuestra cuenta en segundos y exploramos nuestro catálogo conectado a datos reales de NASA LROC y JPL Horizons."* | Clic en **Paso 1: Registro / Cuenta** (`OnboardingModal.tsx`) y recorrido por las tarjetas de `sites.ts` (`IM-2`, `Reiner Gamma`, `Shackleton`). | Nada. |
| **0:35 – 1:40** | **Paso 3 (Robotito + KPI y Filtro de Punto Ciego):** *"Al evaluar el interior del Cráter Shackleton, nuestro asistente virtual ORY-Bot alerta que el KPI cae a NO-GO (19%): se pierde el enlace con la tripulación y la muralla bloquea la línea de visión con el satélite orbital para confirmación fotográfica. Al cambiar a Reiner Gamma o IM-2, el KPI sube a GO (89%)."* | Selección de `Cráter Shackleton` (alerta roja de veto en KPI y banda roja en `ElevationChart.tsx`), seguida del clic en `Reiner Gamma` desde el botón de **ORY-Bot**. | Nada. |
| **1:40 – 2:15** | **Cápsula de Validación Visual 3D (35 s):** *"Para corroborar visualmente lo que nuestro algoritmo SPICE acaba de dictaminar, abrimos esta cápsula de contraste físico 3D en SpaceEngine en la coordenada y época UTC exacta calculada por ORYSEL."* | Panel `ArchitectureDefensePanel.tsx` mostrando la tarjeta **Cápsula de Contraste Físico 3D** con Azimut y Elevación exactos. | **Escena guardada (35 s):** Contraste entre la obstrucción del cráter polar y el horizonte despejado de Reiner Gamma / Mons Mouton. |
| **2:15 – 3:30** | **Triple Segmentación (Profesional, Educativa, Infantil):** *"Segmentamos la misma física en 3 vistas: Profesional con ángulos acimutales y velocidades de escape; Educativa con tarjetas visuales; e Infantil con veredicto binario ('¡Sí se puede!') y nuestro simulador de flechas vectoriales en el cohete."* | Cambio en vivo entre las 3 pestañas (`Vista Profesional`, `Vista Educativa`, `Vista Infantil`) y ajuste de las flechas vectoriales en `RocketVectorPlayground.tsx`. | Nada. |
| **3:30 – 5:00** | **Defensa de Arquitectura en 3 Capas, AWS, Ambiente Lunar y Mentores:** Explicación de los 60 FPS en cliente, APIs abiertas de bajo Ping en AWS, exosfera (~2 km), polvo electrostático, anomalías magnéticas y respaldo matemático (Kepler, Euler-Lagrange, Gauss) con los Dres. Horacio, Jorge, Manuel Martínez, Mendoza y Montero. | Tarjetas inferiores de `ArchitectureDefensePanel.tsx` y tabla de eventos de `report.ts`. | Nada. |
