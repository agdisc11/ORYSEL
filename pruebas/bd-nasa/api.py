"""
ORYSEL open API on AWS EC2 (Ubuntu 24.04 + PostgreSQL 16 + FastAPI).

An account is required for everything except the health check and the
sign-in routes: `/api/sites`, `/api/horizons/*`, `/api/reports/*` and
`/api/compute` need a
Bearer token from `/api/auth/register` or `/api/auth/login`. Accounts live in
the `app` schema; the NASA/JPL Horizons ephemerides in `prueba.horizons_im2`.

Run in production (systemd unit `orysel-api`, behind Caddy, see Caddyfile):
    uvicorn api:app --host 127.0.0.1 --port 8001 --proxy-headers --no-server-header
Interactive docs: https://orysel.duckdns.org/docs

Security notes
  * Passwords are stored only as scrypt hashes with a random salt.
  * Session tokens are random (256 bits); the database keeps only their
    SHA-256, so a leaked table cannot be replayed. Tokens expire in 7 days.
  * Login answers the same message for "no such email" and "wrong password",
    and repeated failures from one address are throttled.
  * Auth uses a Bearer header, never cookies, so CORS "*" cannot be used to
    act on someone's behalf from another site.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

FRONTEND_DIST = "/home/ubuntu/ORYSEL/web/dist"
# Precomputed site reports (web/data in the repo). Not part of the public bundle.
REPORTS_DIR = "/home/ubuntu/ORYSEL/web/data"
SITE_ID_RE = re.compile(r"^[a-z0-9-]{1,64}$")
# Custom coordinates are computed with the same TypeScript SPICE engine as the catalog.
WEB_DIR = "/home/ubuntu/ORYSEL/web"
COMPUTE_CMD = [os.path.join(WEB_DIR, "node_modules", ".bin", "tsx"), "scripts/compute-site.ts"]
COMPUTE_SLOTS = threading.BoundedSemaphore(2)
SESSION_DAYS = 7
APP_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; "
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)

app = FastAPI(
    title="ORYSEL Lunar Mission Open API (AWS + NASA JPL Horizons)",
    description=(
        "Open API on AWS EC2 backed by PostgreSQL with NASA/JPL Horizons ephemerides, "
        "plus user accounts for the MOON DIAL web app."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    path = request.url.path
    if path.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/"):
        # Built files carry a content hash in their name: cache them for good
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif not path.startswith("/api/") and not path.startswith("/docs") and not path.startswith("/openapi"):
        # The page itself is always re-checked, so an update shows up on the next visit
        response.headers["Cache-Control"] = "no-cache"
    # The web app gets a strict policy; /docs keeps its own (Swagger loads from a CDN).
    if not (path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/openapi")):
        response.headers.setdefault("Content-Security-Policy", APP_CSP)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    return response


def get_db_url() -> str:
    env_path = "/home/ubuntu/db.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    return line.strip().split("=", 1)[1]
    return os.environ.get("DATABASE_URL", "")


def connect():
    return psycopg.connect(get_db_url(), row_factory=dict_row)


# ---------------------------------------------------------------------------
# Session check used by every protected route
# ---------------------------------------------------------------------------

bearer = HTTPBearer(auto_error=False, description="Token returned by /api/auth/login or /api/auth/register")


def current_session(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    unauthorized = HTTPException(
        status_code=401, detail="Sign in required", headers={"WWW-Authenticate": "Bearer"}
    )
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise unauthorized
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.name, u.email, s.token_sha256
               FROM app.sessions s JOIN app.users u ON u.id = s.user_id
               WHERE s.token_sha256 = %s AND s.expires_at > now()""",
            (token_sha256(creds.credentials),),
        )
        row = cur.fetchone()
    if not row:
        raise unauthorized
    return row


# ---------------------------------------------------------------------------
# NASA/JPL Horizons data and site reports (account required, except /api/ping)
# ---------------------------------------------------------------------------

@app.get("/api/ping")
def ping_telemetry():
    t0 = time.perf_counter()
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) AS total_rows FROM prueba.horizons_im2;")
        row = cur.fetchone()
    db_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "status": "online",
        "aws_region": "us-east-1",
        "engine": "PostgreSQL 16 + FastAPI",
        "db_query_ms": db_ms,
        "horizons_records": row["total_rows"] if row else 0,
    }


@app.get("/api/sites")
def get_sites_summary(session: dict = Depends(current_session)):
    query = """
    SELECT
        sitio_id,
        cuerpo,
        count(*) AS filas,
        min(t) AS desde,
        max(t) AS hasta,
        round(min(el_deg)::numeric, 2) AS el_min,
        round(max(el_deg)::numeric, 2) AS el_max,
        round(100.0 * avg((el_deg > 0)::int), 1) AS pct_visible
    FROM prueba.horizons_im2
    GROUP BY sitio_id, cuerpo
    ORDER BY sitio_id, cuerpo;
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(query)
        return {"source": "AWS PostgreSQL (NASA/JPL Horizons)", "metrics": cur.fetchall()}


@app.get("/api/horizons/{sitio_id}")
def get_site_ephemeris(
    sitio_id: str = Path(max_length=64),
    limit: int = Query(default=100, ge=1, le=2000),
    session: dict = Depends(current_session),
):
    query = """
    SELECT sitio_id, t, cuerpo, az_deg, el_deg, fuente
    FROM prueba.horizons_im2
    WHERE sitio_id = %s
    ORDER BY t ASC, cuerpo ASC
    LIMIT %s;
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(query, (sitio_id, limit))
        rows = cur.fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="Site not found")
    return {"sitio_id": sitio_id, "count": len(rows), "data": rows}


@app.get("/api/reports/{site_id}")
def get_site_report(
    site_id: str = Path(max_length=64),
    session: dict = Depends(current_session),
):
    """Precomputed SPICE report of one site (series, events, windows, metrics)."""
    if not SITE_ID_RE.match(site_id):
        raise HTTPException(status_code=404, detail="Site not found")
    path = os.path.join(REPORTS_DIR, f"{site_id}.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Site not found")
    return FileResponse(path, media_type="application/json", headers={"Cache-Control": "private, no-store"})


class ComputeIn(BaseModel):
    lat: float = Field(ge=-90, le=90, description="Planetocentric latitude, degrees")
    lon: float = Field(ge=-180, le=180, description="East longitude, degrees")


@app.post("/api/compute")
def compute_custom_site(body: ComputeIn, session: dict = Depends(current_session)):
    """SPICE DE440 report (one month, hourly) for any point on the Moon."""
    key = [f"compute:{session['id']}"]
    if _too_many(key):
        raise HTTPException(status_code=429, detail="Too many calculations, try again in a few minutes")
    if not COMPUTE_SLOTS.acquire(timeout=5):
        raise HTTPException(status_code=503, detail="Server busy, try again in a moment")
    try:
        _record_failure(key)  # counts every calculation toward the per-user limit
        # Arguments are validated floats, passed as a list (no shell).
        result = subprocess.run(
            [*COMPUTE_CMD, f"{body.lat:.6f}", f"{body.lon:.6f}"],
            cwd=WEB_DIR, capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="The calculation took too long")
    finally:
        COMPUTE_SLOTS.release()
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="The calculation failed")
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.users (
    id            bigserial PRIMARY KEY,
    name          text NOT NULL,
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON app.users (lower(email));
CREATE TABLE IF NOT EXISTS app.sessions (
    token_sha256 text PRIMARY KEY,
    user_id      bigint NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON app.sessions (user_id);
"""


@app.on_event("startup")
def create_auth_tables() -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)


EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,63}$")
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# A fixed hash so that a login for an unknown email costs the same time.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def token_sha256(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(cur, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    cur.execute(
        "INSERT INTO app.sessions (token_sha256, user_id, expires_at) VALUES (%s, %s, %s)",
        (token_sha256(token), user_id, expires),
    )
    cur.execute("DELETE FROM app.sessions WHERE expires_at < now()")
    return token


def public_user(row: dict) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


# Throttle over a 10-minute window: 8 failed logins per email, 50 per client
# address, and 10 sign-ups per address (successful or not).
_FAILS: dict[str, deque] = defaultdict(deque)
_FAILS_LOCK = threading.Lock()
FAIL_WINDOW_S = 600
LIMITS = {"email": 8, "ip": 50, "reg-ip": 10, "compute": 20}


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(keys: list[str]) -> bool:
    now = time.monotonic()
    with _FAILS_LOCK:
        for key in keys:
            q = _FAILS[key]
            while q and now - q[0] > FAIL_WINDOW_S:
                q.popleft()
            if len(q) >= LIMITS[key.split(":", 1)[0]]:
                return True
    return False


def _record_failure(keys: list[str]) -> None:
    now = time.monotonic()
    with _FAILS_LOCK:
        for key in keys:
            _FAILS[key].append(now)


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


def _clean_email(email: str) -> str:
    email = email.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    return email


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, request: Request):
    name = " ".join(body.name.split())
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    email = _clean_email(body.email)
    reg_key = [f"reg-ip:{_client_ip(request)}"]
    if _too_many(reg_key):
        raise HTTPException(status_code=429, detail="Too many attempts, try again later")
    _record_failure(reg_key)
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM app.users WHERE lower(email) = lower(%s)", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        cur.execute(
            "INSERT INTO app.users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email",
            (name, email, hash_password(body.password)),
        )
        user = cur.fetchone()
        token = new_session(cur, user["id"])
    return {"token": token, "user": public_user(user)}


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request):
    email = body.email.strip()
    keys = [f"ip:{_client_ip(request)}", f"email:{email.lower()}"]
    if _too_many(keys):
        raise HTTPException(status_code=429, detail="Too many attempts, try again in a few minutes")
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, email, password_hash FROM app.users WHERE lower(email) = lower(%s)",
            (email,),
        )
        user = cur.fetchone()
        ok = verify_password(body.password, user["password_hash"] if user else _DUMMY_HASH)
        if not (user and ok):
            _record_failure(keys)
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        token = new_session(cur, user["id"])
    return {"token": token, "user": public_user(user)}


@app.get("/api/auth/me")
def me(session: dict = Depends(current_session)):
    return {"user": public_user(session)}


@app.post("/api/auth/logout", status_code=204)
def logout(session: dict = Depends(current_session)):
    with connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM app.sessions WHERE token_sha256 = %s", (session["token_sha256"],))


# ---------------------------------------------------------------------------
# The built web app, served from the same origin (no CORS for judges' phones)
# ---------------------------------------------------------------------------

if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
