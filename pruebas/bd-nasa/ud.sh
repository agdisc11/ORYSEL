#!/bin/bash
# Script de aprovisionamiento automático (EC2 User Data / Cloud-Init) para ORYSEL
# Sistema operativo objetivo: Ubuntu 24.04 LTS en AWS EC2 (us-east-1)
# Despliega PostgreSQL 16 + FastAPI + Uvicorn en el puerto 8000 y carga 5,768 registros de NASA/JPL Horizons.

set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y postgresql postgresql-contrib python3-pip python3-venv python3-psycopg2 git curl

systemctl enable postgresql
systemctl start postgresql

# Configurar acceso local para el usuario postgres
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

# Crear directorio de aplicación
mkdir -p /opt/orysel
cd /opt/orysel

# Crear entorno virtual e instalar FastAPI + Uvicorn + Psycopg2
python3 -m venv /opt/orysel/venv
/opt/orysel/venv/bin/pip install --upgrade pip
/opt/orysel/venv/bin/pip install fastapi uvicorn psycopg2-binary

# Clonar repositorio oficial de ORYSEL y sincronizar scripts de base de datos
if [ ! -d "/opt/orysel/repo" ]; then
  git clone https://github.com/agdisc11/ORYSEL.git /opt/orysel/repo
fi

cp /opt/orysel/repo/pruebas/bd-nasa/api.py /opt/orysel/api.py
cp /opt/orysel/repo/pruebas/bd-nasa/cargar_todos.py /opt/orysel/cargar_todos.py

# Poblar PostgreSQL 16 con los 5,768 registros oficiales de NASA/JPL Horizons
sudo -u postgres /opt/orysel/venv/bin/python /opt/orysel/cargar_todos.py

# Configurar servicio systemd para mantener FastAPI activo en el puerto 8000
cat >/etc/systemd/system/orysel-api.service <<'EOF'
[Unit]
Description=ORYSEL FastAPI + PostgreSQL 16 Telemetry Service
After=network.target postgresql.service

[Service]
Type=simple
User=postgres
WorkingDirectory=/opt/orysel
Environment="ORYSEL_DB_DSN=dbname=postgres user=postgres host=localhost"
Environment="AWS_REGION=us-east-1"
ExecStart=/opt/orysel/venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable orysel-api.service
systemctl restart orysel-api.service
