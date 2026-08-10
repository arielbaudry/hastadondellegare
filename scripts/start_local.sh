#!/usr/bin/env bash
# Levanta el micrositio local en :8096 (preview de LAN, http://192.168.1.71:8096).
# En producción esto no se usa: Vercel construye y sirve por su cuenta.
set -euo pipefail

cd "$(dirname "$0")/.."

# npm no está en el PATH de cron.
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=production

# Esta instancia es un ESPEJO de sólo lectura del sitio publicado: la familia
# carga allá, y acá se mira y se guardan respaldos. Sin esto, editar en los dos
# lados haría divergir los árboles en silencio.
export ES_ESPEJO=1
export SITIO_PRINCIPAL="${SITIO_PRINCIPAL:-https://hastadondellegare.vercel.app}"

mkdir -p storage

# Sin build previo no hay .next/BUILD_ID y `next start` falla.
if [ ! -f .next/BUILD_ID ]; then
  npm run build
fi

exec npm run start
