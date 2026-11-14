"""
API REST pública de ORYSEL en AWS EC2 (Ubuntu 24.04 + PostgreSQL 16 + FastAPI).
Expone en tiempo real las efemérides topocéntricas de NASA/JPL Horizons almacenadas
en la tabla `prueba.horizons_im2` (5,768 registros de los 4 sitios lunares).

Ejecución en producción:
    uvicorn api:app --host 0.0.0.0 --port 8000
Documentación interactiva (Swagger UI):
    http://184.194.47.119:8000/docs
"""

import os
import time
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_DSN = os.getenv("ORYSEL_DB_DSN", "dbname=postgres user=postgres host=localhost")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

app = FastAPI(
    title="ORYSEL Lunar Viability & NASA JPL Horizons API",
    description=(
        "API abierta de mecánica orbital y telemetría topocéntrica lunar respaldada por "
        "PostgreSQL 16 en AWS EC2 y efemérides oficiales de NASA/JPL Horizons."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


def get_conn():
    return psycopg2.connect(DB_DSN, cursor_factory=RealDictCursor)


@app.get("/api/ping", summary="Healthcheck y latencia de PostgreSQL en AWS EC2")
def api_ping():
    t0 = time.perf_counter()
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*)::int AS total FROM prueba.horizons_im2;")
            row = cur.fetchone()
            total = row["total"] if row else 0
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PostgreSQL connection error: {exc}") from exc

    db_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "status": "online",
        "aws_region": AWS_REGION,
        "engine": "PostgreSQL 16 + FastAPI",
        "db_query_ms": db_ms,
        "horizons_records": total,
    }


@app.get("/api/sites", summary="Métricas consolidadas de visibilidad Sol/Tierra por sitio lunar")
def api_sites():
    sql = """
        SELECT
            sitio_id,
            cuerpo,
            count(*)::int AS filas,
            min(t) AS desde,
            max(t) AS hasta,
            round(min(el_deg)::numeric, 2)::float AS el_min,
            round(max(el_deg)::numeric, 2)::float AS el_max,
            round(100.0 * avg((el_deg > 0)::int), 1)::float AS pct_visible
        FROM prueba.horizons_im2
        GROUP BY sitio_id, cuerpo
        ORDER BY sitio_id, cuerpo;
    """
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            for r in rows:
                if r.get("desde") is not None:
                    r["desde"] = r["desde"].isoformat()
                if r.get("hasta") is not None:
                    r["hasta"] = r["hasta"].isoformat()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database query error: {exc}") from exc

    return {
        "source": "AWS PostgreSQL (NASA/JPL Horizons)",
        "metrics": rows,
    }


@app.get(
    "/api/horizons/{sitio_id}",
    summary="Serie de tiempo de acimut y elevación (Sol y Tierra) para un sitio lunar",
)
def api_horizons_site(
    sitio_id: str,
    limit: int = Query(default=100, ge=1, le=2000, description="Número máximo de filas a retornar"),
    cuerpo: Optional[str] = Query(default=None, description="Filtrar por 'sol' o 'tierra'"),
):
    if cuerpo in ("sol", "tierra"):
        sql = """
            SELECT sitio_id, t, cuerpo, az_deg, el_deg, fuente
            FROM prueba.horizons_im2
            WHERE sitio_id = %s AND cuerpo = %s
            ORDER BY t ASC, cuerpo ASC
            LIMIT %s;
        """
        params = (sitio_id, cuerpo, limit)
    else:
        sql = """
            SELECT sitio_id, t, cuerpo, az_deg, el_deg, fuente
            FROM prueba.horizons_im2
            WHERE sitio_id = %s
            ORDER BY t ASC, cuerpo ASC
            LIMIT %s;
        """
        params = (sitio_id, limit)

    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            for r in rows:
                if r.get("t") is not None:
                    r["t"] = r["t"].isoformat()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database query error: {exc}") from exc

    return {
        "sitio_id": sitio_id,
        "count": len(rows),
        "rows": rows,
    }
