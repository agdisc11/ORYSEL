# ORYSEL · Lunar Landing Site Navigator & Orbital Viability Platform

NASA Space Apps Challenge 2026 · Tuxtla Gutiérrez · Challenge: **Lunar Landing Site Navigator**.

**ORYSEL** is an orbital intelligence and lunar mission viability platform that computes—using NASA/NAIF SPICE (`DE440`) kernels and JPL Horizons validation—where, when, and with what probability of success a lunar mission can land, generate solar power, and maintain uninterrupted line-of-sight (LoS) communication with both Earth ground stations and orbital reconnaissance satellites.

---

## Key Capabilities Implemented

1. **SPICE DE440 Ephemeris & Geometry Kernel (`web/src/ephemeris/`)**:
   - Runs NASA's SPICE toolkit compiled to JavaScript (`timecraftjs`) in the `MOON_ME` frame with light-time and stellar aberration corrections (`LT+S`).
   - Computes topocentric azimuth (`Az`), elevation (`El`), rise/set crossings to 1-second accuracy (`events.ts`), and visibility windows (`report.ts`).
   - Validated against **NASA/JPL Horizons** (`npm run check:horizons`) to within `0.00003°`.
2. **Executive Mission Viability KPI & Deterministic Blind-Spot Filter (`report.ts`)**:
   - Synthesizes Illumination, Communication Link, Topographic Azimuth clearance, and Lunar Environment factors (~2 km exosphere, electrostatic regolith dust levitation, and local magnetic anomalies like **Reiner Gamma ~28 nT**) into a `0–100%` executive KPI.
   - Automatically penalizes and vetoes (`NO-GO / BLIND SPOT`) sites where crew communication drops below safe elevation margins or where crater walls block direct Line-of-Sight (LoS) with the orbital satellite required for photographic confirmation.
3. **3-Step Guided User Journey (`App.tsx`)**:
   - **Step 1:** Account & Mission Profile Registration (`OnboardingModal.tsx`).
   - **Step 2:** Curated Lunar Sites Catalog (`sites.ts` + `web/public/data/*.json`) featuring **IM-2 Athena (Mons Mouton)**, **Reiner Gamma (Lunar Swirl & Magnetic Anomaly)**, **Shackleton Crater Interior (Blind-Spot Veto Case)**, and **Mare Tranquillitatis (Apollo 11 Benchmark)**.
   - **Step 3:** Interactive viability consultation guided by **ORY-Bot** (`OryBotAssistant.tsx`).
4. **Triple Interface Segmentation (3 User Profiles)**:
   - **Professional View (NASA / Orbital Mechanics):** Full telemetry, azimuth/elevation curves (`ElevationChart.tsx`), orbital insertion velocity ($1.68\text{ km/s}$), surface escape velocity ($2.38\text{ km/s}$), optimal approach azimuth, and $3\sigma$ Gaussian landing ellipse.
   - **Educational View:** Interactive visual cards explaining orbital geometry, lunar libration, and cortical magnetic anomalies without equation overload.
   - **Kids / Gamified View (`RocketVectorPlayground.tsx`):** Converts percentage KPIs into binary verdicts (**"¡Sí se puede!"** / **"No se puede"**) and features an interactive **Rocket Velocity Vector Simulator** with draggable velocity vector arrows to test landing, lunar orbit insertion, and escape velocity.
5. **3-Layer Architecture & Bounded 3D Visual Validation (`ArchitectureDefensePanel.tsx` & `docs/plan-demo-spaceengine.md`)**:
   - **Layer 1 (Client Frontend):** React + Vite optimized for smooth 60 FPS rendering.
   - **Layer 2 (AWS Cloud & Open APIs):** PostgreSQL (`pruebas/bd-nasa/cargar.sql`) + static/edge JSON distribution designed for low-ping continuous downloads and third-party integration.
   - **Layer 3 (Physics Kernel):** Deterministic SPICE/Horizons engine, paired with a bounded 35-second SpaceEngine 3D visual cross-check protocol.

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
