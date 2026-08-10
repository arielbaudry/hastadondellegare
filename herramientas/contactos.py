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
import subprocess
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


# ------------------------------------------------- fotos de perfil de WhatsApp
#
# La línea +5491155238822 (el chatbot de MCV, en la VM de Oracle) está conectada
# a WhatsApp con Baileys. Se le agregó un endpoint que sólo LEE: pregunta si un
# número tiene WhatsApp y devuelve la URL de su foto de perfil — la misma que ve
# cualquiera que lo tenga agendado. No manda mensajes ni abre conversaciones.
#
# Las credenciales del panel del bot no salen de la VM: el pedido se arma allá,
# contra su propio localhost, y por acá sólo vuelve el JSON.

FOTOS_CACHE = DATOS / "whatsapp.json"

# curl no puede tomar la clave de un archivo, así que el script se ejecuta en la
# VM con su .env cargado. Un segundo entre consultas: son pocas, y preguntarle a
# WhatsApp por muchos números seguidos es justo lo que hace un spammer.
SCRIPT_VM = """set -a; . ~/chat/.env; set +a
while read -r n; do
  [ -z "$n" ] && continue
  curl -s -u "$BOT_USERNAME:$BOT_PASSWORD" "http://localhost:10000/foto-perfil?tel=$n"
  echo
  sleep 1
done"""


def variantes(tel):
    """
    El mismo teléfono está escrito de seis maneras distintas en las fichas:
    "2246485878", "01151560011", "+5492257619896". WhatsApp los quiere en
    formato internacional y para Argentina con el 9 del medio, así que en vez de
    adivinar se prueban las formas posibles y gana la que exista.
    """
    d = re.sub(r"\D", "", tel or "")
    if not d:
        return []
    salida = []

    def sumar(x):
        if x and x not in salida:
            salida.append(x)

    if d.startswith("54"):
        resto = d[2:].lstrip("9")
        sumar("549" + resto)
        sumar("54" + resto)
    elif d.startswith("1") and len(d) == 11:
        sumar(d)  # Estados Unidos: ya está completo
    else:
        # Argentino escrito en local ("2246485878", "01151560011"): puede traer
        # el 0 de larga distancia, que no va en el formato internacional.
        #
        # El número crudo NO se prueba, aunque sea lo primero que uno pensaría:
        # WhatsApp lo toma como internacional y "2246485878" le resulta un
        # número válido de Guinea. Contestaba que existe y con foto — la de un
        # desconocido, que habría terminado en la ficha de un familiar.
        local = d.lstrip("0")
        sumar("549" + local)
        sumar("54" + local)
    return salida[:4]


def consultar_whatsapp(numeros):
    """Le pregunta a la línea del bot por una lista de números, de una sola vez."""
    # El script va como comando remoto y los números por stdin: al revés,
    # `bash -s` toma la lista de números como si fuera el script.
    salida = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "oracle", SCRIPT_VM],
        input="\n".join(numeros) + "\n",
        capture_output=True,
        text=True,
        timeout=900,
    )
    if salida.returncode != 0 and not salida.stdout.strip():
        raise RuntimeError(salida.stderr.strip()[:300] or "no se pudo consultar la VM")
    respuestas = {}
    for linea in salida.stdout.splitlines():
        linea = linea.strip()
        if not linea.startswith("{"):
            continue
        try:
            r = json.loads(linea)
        except json.JSONDecodeError:
            continue
        respuestas[r.get("tel")] = r
    return respuestas


def buscar_fotos():
    personas = cargar_arbol(f"{ARBOL}/api/arbol")
    conTel = [p for p in personas if (p.get("celular") or "").strip()]

    intentos = {p["id"]: variantes(p["celular"]) for p in conTel}
    todos = [n for v in intentos.values() for n in v]
    respuestas = consultar_whatsapp(sorted(set(todos)))

    salida = []
    for p in conTel:
        elegida = None
        for n in intentos[p["id"]]:
            r = respuestas.get(n)
            if r and r.get("existe"):
                elegida = r
                break
        salida.append(
            {
                "id": p["id"],
                "nombre": f"{p['nombres']} {p['apellidos']}".strip(),
                "celular": p["celular"],
                "fotos": len(p.get("fotos") or []),
                "numero": elegida.get("tel") if elegida else None,
                "url": (elegida or {}).get("url"),
                "estado": (
                    "con foto" if elegida and elegida.get("url")
                    else "sin foto de perfil" if elegida
                    else "no tiene WhatsApp"
                ),
            }
        )
    # Primero los que aportan algo: foto nueva para quien no tiene ninguna.
    salida.sort(key=lambda x: (x["url"] is None, x["fotos"] > 0, x["nombre"]))
    DATOS.mkdir(exist_ok=True)
    FOTOS_CACHE.write_text(json.dumps({"personas": salida}, ensure_ascii=False, indent=1), "utf8")
    return salida


@app.get("/api/whatsapp")
def api_whatsapp():
    if FOTOS_CACHE.exists():
        return jsonify(json.loads(FOTOS_CACHE.read_text("utf8")))
    return jsonify({"personas": []})


@app.post("/api/whatsapp/buscar")
def api_whatsapp_buscar():
    try:
        return jsonify({"personas": buscar_fotos()})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.post("/api/whatsapp/importar")
def api_whatsapp_importar():
    """
    Baja el avatar y lo suma a la ficha. **Suma**: las fotos del árbol nunca se
    pisan, cada quien sube la que tiene y la primera es el retrato.
    """
    elegidos = request.json.get("personas") or []
    guardadas = {p["id"]: p for p in json.loads(FOTOS_CACHE.read_text("utf8"))["personas"]}
    arbol = {p["id"]: p for p in cargar_arbol(f"{ARBOL}/api/arbol")}
    resultados = []

    for pid in elegidos:
        info, ficha = guardadas.get(pid), arbol.get(pid)
        if not info or not info.get("url") or not ficha:
            resultados.append({"id": pid, "ok": False, "error": "sin foto o sin ficha"})
            continue
        try:
            with urllib.request.urlopen(info["url"], timeout=30) as r:
                imagen = r.read()

            # multipart a mano: es un solo campo y no vale traerse una librería.
            borde = "----hdll" + os.urandom(8).hex()
            cuerpo = (
                f"--{borde}\r\n"
                f'Content-Disposition: form-data; name="foto"; filename="whatsapp.jpg"\r\n'
                f"Content-Type: image/jpeg\r\n\r\n"
            ).encode() + imagen + f"\r\n--{borde}--\r\n".encode()
            subida = urllib.request.Request(
                f"{ARBOL}/api/fotos",
                data=cuerpo,
                headers={"Content-Type": f"multipart/form-data; boundary={borde}"},
            )
            with urllib.request.urlopen(subida, timeout=60) as r:
                url = json.load(r)["url"]

            fotos = list(ficha.get("fotos") or []) + [url]
            patch = urllib.request.Request(
                f"{ARBOL}/api/personas/{pid}",
                data=json.dumps({"persona": {"fotos": fotos}, "autor": AUTOR}).encode(),
                method="PATCH",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(patch, timeout=30) as r:
                json.load(r)
            resultados.append({"id": pid, "ok": True})
        except urllib.error.HTTPError as e:
            resultados.append(
                {"id": pid, "ok": False, "error": f"HTTP {e.code}: {e.read().decode('utf8','ignore')[:150]}"}
            )
        except Exception as e:
            resultados.append({"id": pid, "ok": False, "error": str(e)})

    return jsonify({"resultados": resultados})


@app.get("/fotos")
def pagina_fotos():
    return (Path(__file__).parent / "fotos.html").read_text("utf8")


@app.get("/")
def index():
    return (Path(__file__).parent / "contactos.html").read_text("utf8")


if __name__ == "__main__":
    DATOS.mkdir(exist_ok=True)
    print(f"Contactos — cruce árbol × CRM  ·  http://192.168.1.71:{PUERTO}")
    app.run(host="0.0.0.0", port=PUERTO, debug=False)
