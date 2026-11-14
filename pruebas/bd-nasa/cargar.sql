-- Prueba de carga: datos de NASA/JPL Horizons en PostgreSQL.
-- Todo queda en el esquema "prueba" para no mezclarlo con las tablas reales.
-- Para borrarlo todo:  DROP SCHEMA prueba CASCADE;

CREATE SCHEMA IF NOT EXISTS prueba;

DROP TABLE IF EXISTS prueba.horizons_im2;

CREATE TABLE prueba.horizons_im2 (
    sitio_id text             NOT NULL,
    t        timestamptz      NOT NULL,
    cuerpo   text             NOT NULL CHECK (cuerpo IN ('sol', 'tierra')),
    az_deg   double precision NOT NULL CHECK (az_deg >= 0 AND az_deg < 360),
    el_deg   double precision NOT NULL CHECK (el_deg BETWEEN -90 AND 90),
    fuente   text             NOT NULL DEFAULT 'NASA/JPL Horizons API',
    PRIMARY KEY (sitio_id, cuerpo, t)
);

\copy prueba.horizons_im2 (sitio_id, t, cuerpo, az_deg, el_deg) FROM 'horizons_im2.csv' WITH (FORMAT csv, HEADER)

\echo '--- Filas por cuerpo y rango de fechas'
SELECT cuerpo, count(*) AS filas, min(t) AS desde, max(t) AS hasta,
       round(min(el_deg)::numeric, 2) AS el_min, round(max(el_deg)::numeric, 2) AS el_max
FROM prueba.horizons_im2
GROUP BY cuerpo ORDER BY cuerpo;

\echo '--- Porcentaje del tiempo sobre el horizonte liso (elevacion > 0)'
SELECT cuerpo, round(100.0 * avg((el_deg > 0)::int), 1) AS pct_visible
FROM prueba.horizons_im2
GROUP BY cuerpo ORDER BY cuerpo;

\echo '--- Primeras filas de hoy'
SELECT t, cuerpo, az_deg, el_deg FROM prueba.horizons_im2
WHERE t < '2026-11-14 03:00+00' ORDER BY t, cuerpo;
