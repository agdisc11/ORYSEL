"""Prueba: baja datos abiertos de NASA (JPL Horizons) y los deja en un CSV.

Pide a la API de Horizons el azimut y la elevacion del Sol y de la Tierra,
vistos desde un sitio de la Luna, y escribe un CSV listo para cargar en
PostgreSQL con \\copy.

Uso (en el servidor):  python3 descargar_horizons.py horizons_im2.csv
Solo usa la biblioteca estandar de Python.
"""
import csv
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Sitio de prueba. Fuente de la coordenada: LROC, "IM-2 Athena Seen Obliquely"
# (posicion medida). Altura 0 km = esfera de referencia (solo para la prueba).
SITIO = {"id": "im2", "lat": -84.7906, "lon": 29.1957, "altura_km": 0.0}

CUERPOS = {"sol": "10", "tierra": "399"}
INICIO = "2026-11-14 00:00"
FIN = "2026-12-14 00:00"
PASO = "1 h"


def pedir(codigo_cuerpo: str) -> str:
    """Devuelve la respuesta de texto de Horizons para un cuerpo."""
    parametros = {
        "format": "text",
        "COMMAND": f"'{codigo_cuerpo}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",  # un punto sobre la Luna (cuerpo 301)
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{SITIO['lon']},{SITIO['lat']},{SITIO['altura_km']}'",
        "START_TIME": f"'{INICIO}'",
        "STOP_TIME": f"'{FIN}'",
        "STEP_SIZE": f"'{PASO}'",
        "QUANTITIES": "'4'",  # azimut y elevacion aparentes
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }
    url = API_URL + "?" + urllib.parse.urlencode(parametros)
    with urllib.request.urlopen(url, timeout=60) as respuesta:
        return respuesta.read().decode("utf-8")


def filas(texto: str):
    """Saca (fecha UTC, azimut, elevacion) de lo que hay entre $$SOE y $$EOE."""
    dentro = False
    for linea in texto.splitlines():
        if linea.startswith("$$SOE"):
            dentro = True
            continue
        if linea.startswith("$$EOE"):
            break
        if not dentro or not linea.strip():
            continue
        partes = [p.strip() for p in linea.split(",")]
        fecha = datetime.strptime(partes[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        yield fecha.isoformat(), float(partes[3]), float(partes[4])


def main() -> None:
    destino = sys.argv[1] if len(sys.argv) > 1 else "horizons_im2.csv"
    total = 0
    with open(destino, "w", newline="", encoding="utf-8") as archivo:
        salida = csv.writer(archivo)
        salida.writerow(["sitio_id", "t", "cuerpo", "az_deg", "el_deg"])
        for nombre, codigo in CUERPOS.items():
            texto = pedir(codigo)
            if "$$SOE" not in texto:
                sys.exit(f"Horizons no devolvio datos para {nombre}:\n{texto[:800]}")
            for t, az, el in filas(texto):
                salida.writerow([SITIO["id"], t, nombre, az, el])
                total += 1
    print(f"{total} filas -> {destino}")


if __name__ == "__main__":
    main()
