# ORYSEL · Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 · Tuxtla Gutiérrez · challenge "Lunar Landing Site Navigator".

A web app that tells, for a landing site on the Moon, when the Sun is up (power) and
when the Earth is in view (direct communication), and compares sites.

Status: work in progress, written during the hackathon (14–15 November 2026).

## What works today

- **Ephemeris engine in TypeScript** (`web/src/ephemeris`). It runs NASA's SPICE toolkit
  (CSPICE compiled to JavaScript by NASA-AMMOS, package `timecraftjs`) with the DE440
  kernels and gives the azimuth and elevation of the Sun and the Earth from any point on
  the lunar surface, rise and set times to one second, visibility windows and summary
  metrics. A terrain horizon can be plugged in; today the horizon is a smooth sphere.
- **First screen in React** (`web/src/App.tsx`): one month at the IM-2 site (Mons Mouton).
- **Validation**: one month of hourly values for IM-2 agrees with NASA/JPL Horizons to
  0.00003 degrees (`npm run check:horizons`).

## Run it

```bash
cd web
npm install
npm run kernels      # downloads the NASA/NAIF kernels (about 35 MB) and checks SHA-256
npm run precompute   # writes public/data/<site>.json
npm run dev          # opens the app
npm test             # unit tests + Horizons comparison (needs internet)
```

## Conventions

Frame MOON_ME · planetocentric latitude · east longitude −180..180 · sphere of 1737.4 km ·
UTC · azimuth from north, clockwise · apparent positions (light time + stellar aberration).
Every site coordinate carries its source; no source, no site.

## NASA data and tools

- NAIF generic kernels: `naif0012.tls`, `pck00011.tpc`, `moon_pa_de440_200625.bpc`,
  `moon_de440_250416.tf`, `de440s.bsp` — https://naif.jpl.nasa.gov/naif/data_generic.html
- SPICE toolkit (NAIF) through `timecraftjs` (NASA-AMMOS, Apache-2.0)
- JPL Horizons API, for validation only — https://ssd.jpl.nasa.gov/horizons/
- Site coordinates: NASA LROC

## Use of AI

Code and documents in this repository were written with the help of an AI assistant
(Claude, by Anthropic) during the event, directed and reviewed by the team.

## Folders

- `web/` — the app (Vite + React + TypeScript)
- `docs/` — team board and demo plan (Spanish)
- `pruebas/` — test that loads JPL Horizons data into the team's PostgreSQL server
