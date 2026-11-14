# ORYSEL · Lunar Landing Site Navigator & Orbital Viability Platform

NASA Space Apps Challenge 2026 · Tuxtla Gutiérrez · Challenge: **Lunar Landing Site Navigator**.

**ORYSEL** is an orbital intelligence and lunar mission viability platform that computes—using NASA/NAIF SPICE (`DE440`) kernels and a live **AWS EC2 PostgreSQL 16 + FastAPI** backend synchronized with **NASA/JPL Horizons** (`5,768` verified ephemeris records)—where, when, and with what probability of success a lunar mission can land, generate solar power, and maintain uninterrupted line-of-sight (LoS) communication with both Earth ground stations and orbital reconnaissance satellites.

---

## Live AWS EC2 Backend & Open Telemetry API (`us-east-1`)

Our cloud backend runs Ubuntu 24.04 + PostgreSQL 16 + FastAPI at `http://184.194.47.119:8000` with `CORS (*)` enabled so external teams, universities, and web applications can integrate our lunar telemetry directly:

- **Swagger UI (Interactive OpenAPI Docs):** `http://184.194.47.119:8000/docs`
- **Healthcheck & DB Latency (`GET /api/ping`):** `http://184.194.47.119:8000/api/ping`
  - Returns live `aws_region`, `engine`, `db_query_ms`, and `horizons_records` (`5,768` rows across 4 lunar sites).
- **Consolidated Site Visibility (`GET /api/sites`):** `http://184.194.47.119:8000/api/sites`
  - Returns Sun & Earth min/max elevation and `pct_visible` across `apollo11`, `im2`, `reiner-gamma`, and `shackleton-blindspot`.
- **Site Horizon Time Series (`GET /api/horizons/{sitio_id}`):** `http://184.194.47.119:8000/api/horizons/im2?limit=100`
  - Returns hourly azimuth (`az_deg`) and elevation (`el_deg`) rows from `prueba.horizons_im2`.

All backend deployment and ingestion scripts are available in [`pruebas/bd-nasa/`](./pruebas/bd-nasa/):
- `api.py`: FastAPI REST server exposing `/api/ping`, `/api/sites`, and `/api/horizons/{sitio_id}`.
- `cargar_todos.py`: Queries NASA/JPL Horizons API for all 4 lunar sites (`sol` and `tierra`) and populates `prueba.horizons_im2` (`5,768` rows).
- `ud.sh`: Automated AWS EC2 Ubuntu 24.04 user-data (`cloud-init`) provisioning script.
- `cargar.sql` & `descargar_horizons.py`: Base SQL schema and standalone Horizons ingestion utility.

---

## Key Capabilities Implemented

1. **SPICE DE440 Ephemeris & Geometry Kernel (`web/src/ephemeris/`)**:
   - Runs NASA's SPICE toolkit compiled to JavaScript (`timecraftjs`) in the `MOON_ME` frame with light-time and stellar aberration corrections (`LT+S`).
   - Computes topocentric azimuth (`Az`), elevation (`El`), rise/set crossings to 1-second accuracy (`events.ts`), and visibility windows (`report.ts`).
   - Validated against **NASA/JPL Horizons** (`npm run check:horizons`) to within `0.00003°`.
2. **Real-Time AWS Telemetry + Client FPS Monitor (`web/src/ephemeris/awsApi.ts`)**:
   - Measures real-time network RTT (`performance.now()`) against `GET /api/ping` and synchronizes `/api/sites` and `/api/horizons/{sitio_id}`.
   - Includes a `requestAnimationFrame` client FPS hook (`useClientFps`) displayed in the topbar next to AWS RTT Ping and PostgreSQL query time (`db_query_ms`), with automatic 3-second silent offline fallback.
3. **Executive Mission Viability KPI & Deterministic Blind-Spot Filter (`report.ts`)**:
   - Synthesizes Illumination, Communication Link, Topographic Azimuth clearance, and Lunar Environment factors (~2 km exosphere, electrostatic regolith dust levitation, and local magnetic anomalies like **Reiner Gamma ~28 nT**) into a `0–100%` executive KPI.
   - Automatically penalizes and vetoes (`NO-GO / BLIND SPOT`) sites where crew communication drops below safe elevation margins or where crater walls block direct Line-of-Sight (LoS) with the orbital satellite required for photographic confirmation.
4. **Clean Mission Control Interface with 4 Strictly Separated Audience Views (`App.tsx`)**:
   - **Compact Executive Topbar:** 1-line mission header with Lunar Site Selector, 4-View Audience Switcher, live `FPS Cliente` badge, live `AWS Ping | DB ms | 5,768 rows` badge, `"Arquitectura & API AWS"` modal button, and Account/Onboarding button.
   - **1. Vista Ejecutiva (`Ejecutiva KPI`):** Consolidated Viability KPI, deterministic `GO` / `CAUTION` / `NO-GO` verdict, live comparative Sun & Earth visibility cards from AWS PostgreSQL (`prueba.horizons_im2`), and Lunar Environmental Risk diagnostics.
   - **2. Vista Profesional (`Profesional NASA`):** Rigorous orbital mechanics breakdown (`ElevationChart.tsx`, azimuth/elevation, orbital velocity $1.68\text{ km/s}$, escape velocity $2.38\text{ km/s}$, live JPL Horizons time-series table from AWS EC2, and bounded **SpaceEngine 3D** validation coordinates).
   - **3. Vista Educativa (`Educativa`):** Interactive visual cards explaining orbital geometry, lunar libration, and cortical magnetic anomalies alongside the horizon elevation chart without raw numerical clutter.
   - **4. Vista Infantil / Gamificada (`Infantil / Gamificada`):** Exclusively renders the giant binary verdict (**"¡SÍ SE PUEDE ATERRIZAR!"** / **"¡NO SE PUEDE, PERDEMOS SEÑAL!"**) and the interactive **Rocket Velocity Vector Simulator (`RocketVectorPlayground.tsx`)**.
5. **Floating ORY-Bot Assistant & 3-Layer Architecture Modal (`OryBotAssistant.tsx` & `ArchitectureDefensePanel.tsx`)**:
   - **ORY-Bot** operates as a collapsible floating widget in the bottom-right corner so it never crowds the main workspace.
   - **Architecture & Open API Modal** documents our 3-layer stack, Universidad Politécnica academic advisory board, direct link to Swagger UI (`/docs`), and copyable `fetch` + `<iframe>` integration snippets.

---

## Quick Start

```bash
cd web
npm install
npm run kernels      # downloads NASA/NAIF kernels (~35 MB) and verifies SHA-256
npm run precompute   # precomputes public/data/<site>.json for all sites in sites.ts
npm run dev          # starts the Vite development server
npm test             # runs unit tests + JPL Horizons validation
npm run build        # type-checks and builds the production bundle
```
