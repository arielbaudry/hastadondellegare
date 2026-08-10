#!/usr/bin/env bash
# Trae el árbol publicado a este servidor y deja constancia de que el sitio
# responde. Dos cosas de una:
#
#   1. el espejo local queda al día (es de sólo lectura: acá no se edita);
#   2. queda un respaldo con fecha, fuera de Vercel y fuera de GitHub.
#
# De paso mantiene despierta la función de Vercel. Aclaración honesta: Vercel no
# "apaga" nada — no hay un servidor que se duerma como en otros hostings. Lo que
# sí pasa es que si nadie entra en un rato, la primera visita arranca en frío y
# tarda un segundo más. Este ping lo evita, y sobre todo avisa si el sitio se
# cayó, que es lo que de verdad importa.
set -uo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"

SITIO="${SITIO:-https://hastadondellegare.vercel.app}"
REGISTRO="storage/vigilancia.log"
mkdir -p storage

ahora() { TZ=America/Argentina/Buenos_Aires date '+%Y-%m-%d %H:%M'; }

inicio=$(date +%s%N)
codigo=$(curl -s -o /tmp/hdll-ping.json -D /tmp/hdll-ping.head -w '%{http_code}' --max-time 30 "$SITIO/api/arbol")
rc=$?
ms=$(( ($(date +%s%N) - inicio) / 1000000 ))

# El "Vercel Security Checkpoint" contesta 403 a todo lo que no sea un navegador
# resolviendo su desafío de JavaScript. El sitio NO está caído: está detrás de la
# protección contra ataques, que se prende sola ante una ráfaga de tráfico
# automatizado. Confundirlo con una caída manda a buscar el problema donde no
# está — y lo que hay que hacer es apagarla en el panel de Vercel (Firewall).
if grep -qi '^x-vercel-mitigated: *challenge' /tmp/hdll-ping.head 2>/dev/null; then
  echo "$(ahora) PROTEGIDO Vercel pide el desafío del navegador — apagar Attack Challenge Mode en el panel (${ms}ms)" >> "$REGISTRO"
  exit 0
fi

if [ "$rc" -ne 0 ] || [ "$codigo" != "200" ]; then
  echo "$(ahora) CAIDO codigo=$codigo curl=$rc ${ms}ms" >> "$REGISTRO"
  exit 1
fi

personas=$(python3 -c "import json;print(len(json.load(open('/tmp/hdll-ping.json'))['personas']))" 2>/dev/null || echo "?")
echo "$(ahora) OK ${ms}ms personas=$personas" >> "$REGISTRO"

# El respaldo con fecha se guarda una vez por día; el resto de las corridas son
# sólo el ping.
if [ ! -f "storage/respaldos/arbol-$(date +%F).json" ]; then
  SITIO="$SITIO" node scripts/respaldar.mjs >> "$REGISTRO" 2>&1
fi

# El espejo se queda con lo mismo que está publicado.
python3 - "$SITIO" <<'PY' >> "$REGISTRO" 2>&1
import json, sys, os
datos = json.load(open("/tmp/hdll-ping.json"))
if not datos.get("personas"):
    sys.exit(0)
destino = "storage/tree.json"
actual = json.load(open(destino)) if os.path.exists(destino) else {"rev": -1}
if actual.get("rev") == datos["rev"] and len(actual.get("personas", [])) == len(datos["personas"]):
    sys.exit(0)
json.dump({"rev": datos["rev"], "esEjemplo": False,
           "actualizadoEn": datos["actualizadoEn"], "personas": datos["personas"]},
          open(destino + ".tmp", "w"), ensure_ascii=False, indent=2)
os.replace(destino + ".tmp", destino)
print(f"  espejo actualizado: {len(datos['personas'])} personas (rev {datos['rev']})")
PY

# Sólo las últimas 2000 líneas del registro.
tail -n 2000 "$REGISTRO" > "$REGISTRO.tmp" && mv "$REGISTRO.tmp" "$REGISTRO"
