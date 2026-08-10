#!/usr/bin/env python3
"""
Contactos — página temporal para cruzar el árbol con el CRM del servidor.

Qué hace: busca en el Padrón CRM (629 mil contactos) a las personas del árbol,
muestra los candidatos ordenados por qué tan parecidos son, y deja **confirmar a
mano** cuáles son la misma persona y qué dato de cada uno vale. Recién ahí lo
manda al árbol publicado.

Por qué a mano: el CRM tiene homónimos a montones —hay tres "Maria Ines
Rodriguez" en el padrón de IOMA— y meter un teléfono equivocado en la ficha de
un familiar es peor que no tener el dato.

Es temporal y corre sólo acá: el CRM vive en una MariaDB local que no sale a
internet. Cuando termine el cruce, se apaga y se borra.

    /usr/bin/python3 contactos.py          # http://192.168.1.71:8098
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from flask import Flask, jsonify, request

sys.path.insert(0, str(Path(__file__).parent))
from cotejo import cargar_arbol, candidatos_del_crm, cotejar, norm  # noqa: E402

PUERTO = int(os.environ.get("CONTACTOS_PUERTO", 8098))
ARBOL = os.environ.get("ARBOL_URL", "https://hastadondellegare.vercel.app")
AUTOR = os.environ.get("ARBOL_AUTOR", "Ariel Osvaldo Baudry")
# Se puede apuntar a otro lado para probar sin pisar las decisiones reales.
DATOS = Path(os.environ.get("CONTACTOS_DIR", Path(__file__).parent / "storage"))
CACHE = DATOS / "cotejo.json"
DECISIONES = DATOS / "decisiones.json"

app = Flask(__name__)


# ------------------------------------------------------------------- el cruce

def multiples(*valores):
    """
    Un campo del CRM puede traer varios adentro: los importadores juntaron los
    correos con " ::: " y los teléfonos con coma o punto y coma. Cada uno tiene
    que ser una opción aparte, o se ofrece elegir un mail que no existe.
    """
    salida, vistos = [], set()
    for v in valores:
        for parte in re.split(r":::|[;,]", v or ""):
            parte = parte.strip()
            if parte and parte not in vistos:
                vistos.add(parte)
                salida.append(parte)
    return salida


def calcular():
    """Corre el cruce completo y lo deja en disco: tarda, y no cambia solo."""
    personas = cargar_arbol(f"{ARBOL}/api/arbol")
    apellidos = {
        w
        for p in personas
        for w in norm(p["apellidos"]) + norm(p.get("apellidoNacimiento"))
        if len(w) >= 4
    }
    contactos = candidatos_del_crm(apellidos)
    cruce = cotejar(personas, contactos)

    # A la pantalla va sólo lo que se mira: la ficha como está hoy y lo que el
    # CRM sabe de cada candidato.
    salida = []
    for r in cruce:
        p = r["persona"]
        salida.append(
            {
                "id": p["id"],
                "nombre": f"{p['nombres']} {p['apellidos']}".strip(),
                "actual": {
                    "celular": p.get("celular") or "",
                    "email": p.get("email") or "",
                    "direccion": p.get("direccion") or "",
                },
                "candidatos": [
                    {
                        "id": c["contacto"]["id"],
                        "puntaje": c["puntaje"],
                        "motivo": c["motivo"],
                        "nombre": c["contacto"]["nombre_completo"],
                        "fuente": c["contacto"]["fuente_sistema"],
                        "celular": multiples(
                            c["contacto"].get("telefono"),
                            c["contacto"].get("telefono_2"),
                            c["contacto"].get("telefono_fijo"),
                        ),
                        "email": multiples(
                            c["contacto"].get("email"),
                            c["contacto"].get("email_secundario"),
                        ),
                        # La dirección no se parte: las comas son parte del dato.
                        "direccion": [
                            v
                            for v in (
                                c["contacto"].get("direccion"),
                                ", ".join(
                                    x
                                    for x in (
                                        c["contacto"].get("ciudad"),
                                        c["contacto"].get("provincia"),
                                    )
                                    if x
                                ),
                            )
                            if v
                        ],
                    }
                    for c in r["candidatos"]
                ],
            }
        )
    salida.sort(key=lambda x: -x["candidatos"][0]["puntaje"])
    DATOS.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps({"personas": salida}, ensure_ascii=False, indent=1), "utf8")
    return salida


def leer_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text("utf8"))["personas"]
    return calcular()


# --------------------------------------------------------------------- la API

@app.get("/api/cotejo")
def api_cotejo():
    return jsonify(
        {
            "personas": leer_cache(),
            "decisiones": json.loads(DECISIONES.read_text("utf8")) if DECISIONES.exists() else {},
            "arbol": ARBOL,
        }
    )


@app.post("/api/recalcular")
def api_recalcular():
    return jsonify({"personas": calcular()})


@app.post("/api/decisiones")
def api_decisiones():
    """Lo elegido se guarda en cuanto se toca: son 47 fichas, no se rehace."""
    DATOS.mkdir(exist_ok=True)
    DECISIONES.write_text(json.dumps(request.json, ensure_ascii=False, indent=1), "utf8")
    return jsonify({"ok": True})


@app.post("/api/aplicar")
def api_aplicar():
    """Manda al árbol publicado los campos elegidos, una ficha por vez."""
    cambios = request.json.get("cambios") or []
    resultados = []
    for c in cambios:
        campos = {k: v for k, v in (c.get("campos") or {}).items() if v is not None}
        if not campos:
            continue
        cuerpo = json.dumps({"persona": campos, "autor": AUTOR}).encode()
        pedido = urllib.request.Request(
            f"{ARBOL}/api/personas/{c['id']}",
            data=cuerpo,
            method="PATCH",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(pedido, timeout=30) as r:
                json.load(r)
            resultados.append({"id": c["id"], "ok": True})
        except urllib.error.HTTPError as e:
            detalle = e.read().decode("utf8", "ignore")[:200]
            resultados.append({"id": c["id"], "ok": False, "error": f"HTTP {e.code}: {detalle}"})
        except Exception as e:  # red caída, timeout
            resultados.append({"id": c["id"], "ok": False, "error": str(e)})
    return jsonify({"resultados": resultados})


@app.get("/")
def index():
    return (Path(__file__).parent / "contactos.html").read_text("utf8")


if __name__ == "__main__":
    DATOS.mkdir(exist_ok=True)
    print(f"Contactos — cruce árbol × CRM  ·  http://192.168.1.71:{PUERTO}")
    app.run(host="0.0.0.0", port=PUERTO, debug=False)
