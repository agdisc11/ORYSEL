"""
Descarga las efemérides topocéntricas de los 4 sitios lunares de ORYSEL
desde la API oficial de NASA/JPL Horizons (Sol y Tierra, 721 pasos horarios por cuerpo = 5,768 filas)
y las inserta en PostgreSQL (`prueba.horizons_im2`).

Uso directo con psql / psycopg2:
    python3 cargar_todos.py
"""

import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import execute_values

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
DB_DSN = os.getenv("ORYSEL_DB_DSN", "dbname=postgres user=postgres host=localhost")

SITIOS = [
    {"id": "im2", "lon": 1.4309, "lat": -84.7906, "alt": -1.307},
    {"id": "apollo11", "lon": 23.4730, "lat": 0.6742, "alt": -1.900},
    {"id": "reiner-gamma", "lon": -59.0000, "lat": 7.5000, "alt": -1.400},
    {"id": "shackleton-blindspot", "lon": 120.0000, "lat": -89.8000, "alt": -2.100},
]

CUERPOS = {
    "sol": "10",
    "tierra": "399",
}

DESDE = "2026-11-14 00:00"
HASTA = "2026-12-14 00:00"
PASO = "1 h"

MESES = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def consultar_horizons(command: str, lon: float, lat: float, alt: float) -> str:
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},{alt}'",
        "START_TIME": f"'{DESDE}'",
        "STOP_TIME": f"'{HASTA}'",
        "STEP_SIZE": f"'{PASO}'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    url = f"{HORIZONS_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read().decode("utf-8")


def parsear_bloque_soe(texto: str):
    m = re.search(r"\$\$SOE\s*(.*?)\s*\$\$EOE", texto, re.DOTALL)
    if not m:
        raise RuntimeError("No se encontró el bloque $$SOE..$$EOE en la respuesta de Horizons")

    filas = []
    for linea in m.group(1).strip().splitlines():
        partes = [p.strip() for p in linea.split(",")]
        fecha_raw = partes[0]
        az, el = float(partes[3]), float(partes[4])
        partes_f = fecha_raw.split()
        a_str, m_str, d_str = partes_f[0].split("-")
        hh, mm = partes_f[1].split(":")
        dt = datetime(int(a_str), MESES[m_str], int(d_str), int(hh), int(mm), tzinfo=timezone.utc)
        filas.append((dt.isoformat(), az, el))
    return filas


def asegurar_esquema(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE SCHEMA IF NOT EXISTS prueba;
            CREATE TABLE IF NOT EXISTS prueba.horizons_im2 (
                sitio_id text             NOT NULL,
                t        timestamptz      NOT NULL,
                cuerpo   text             NOT NULL CHECK (cuerpo IN ('sol', 'tierra')),
                az_deg   double precision NOT NULL,
                el_deg   double precision NOT NULL,
                fuente   text             NOT NULL DEFAULT 'NASA/JPL Horizons API',
                PRIMARY KEY (sitio_id, cuerpo, t)
            );
            """
        )
    conn.commit()


def main():
    registros = []
    for sitio in SITIOS:
        for nombre_cuerpo, id_naif in CUERPOS.items():
            print(f"[Horizons] Descargando sitio={sitio['id']} cuerpo={nombre_cuerpo} ({id_naif})...")
            texto = consultar_horizons(id_naif, sitio["lon"], sitio["lat"], sitio["alt"])
            for iso_t, az, el in parsear_bloque_soe(texto):
                registros.append((sitio["id"], iso_t, nombre_cuerpo, az, el, "NASA/JPL Horizons API"))

    print(f"[PostgreSQL] Conectando e insertando {len(registros)} registros en prueba.horizons_im2...")
    with psycopg2.connect(DB_DSN) as conn:
        asegurar_esquema(conn)
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO prueba.horizons_im2 (sitio_id, t, cuerpo, az_deg, el_deg, fuente)
                VALUES %s
                ON CONFLICT (sitio_id, cuerpo, t) DO UPDATE
                SET az_deg = EXCLUDED.az_deg,
                    el_deg = EXCLUDED.el_deg,
                    fuente = EXCLUDED.fuente;
                """,
                registros,
            )
        conn.commit()
    print(f"[OK] {len(registros)} filas sincronizadas exitosamente en PostgreSQL.")


if __name__ == "__main__":
    main()
