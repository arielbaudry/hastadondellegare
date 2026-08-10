#!/usr/bin/env python3
"""
Cruza el árbol genealógico con los contactos del CRM (Padrón).

El CRM tiene 600 mil contactos y la familia 72 personas: la mayoría de las
coincidencias por apellido son homónimos. Por eso no alcanza con el apellido —
se pide además que coincida un nombre de pila, y se puntúa qué tan completa es
la coincidencia. Lo que sale de acá son *candidatos*, no verdades: quién es
quién lo decide una persona mirando la pantalla.
"""
import json, re, sys, unicodedata
sys.path.insert(0, "/home/hpp/padron")
import db

CAMPOS = ("id", "nombre_completo", "nombre", "apellido", "email", "email_secundario",
          "telefono", "telefono_2", "telefono_fijo", "ciudad", "provincia", "pais",
          "direccion", "documento", "fuente_sistema", "notas")


def norm(s):
    s = unicodedata.normalize("NFD", (s or "")).encode("ascii", "ignore").decode()
    return [w for w in re.sub(r"[^a-z0-9 ]", " ", s.lower()).split() if w]


def distancia(a, b):
    """Levenshtein simple, para aguantar una letra de diferencia."""
    if abs(len(a) - len(b)) > 1:
        return 2
    fila = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        previo, fila[0] = fila[0], i
        for j, cb in enumerate(b, 1):
            previo, fila[j] = fila[j], min(fila[j] + 1, fila[j - 1] + 1, previo + (ca != cb))
    return fila[-1]


def parecidas(a, b):
    return a == b or (len(a) >= 4 and len(b) >= 4 and distancia(a, b) <= 1)


def solo_digitos(s):
    d = re.sub(r"\D", "", s or "")
    return d[-8:] if len(d) >= 8 else ""      # los últimos 8 evitan el lío de 011/15/+54


def cargar_arbol(url="https://hastadondellegare.vercel.app/api/arbol"):
    import urllib.request
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)["personas"]


def candidatos_del_crm(apellidos):
    patron = "|".join(sorted(apellidos))
    conn = db.get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {', '.join(CAMPOS)} FROM contactos WHERE LOWER(nombre_completo) REGEXP %s",
            (patron,),
        )
        return cur.fetchall()


def cotejar(personas, contactos):
    """Para cada persona, sus mejores candidatos del CRM."""
    # Índices de contacto: un mail o un teléfono igual valen más que cualquier
    # parecido de nombre.
    por_mail, por_tel = {}, {}
    for c in contactos:
        for campo in ("email", "email_secundario"):
            if c.get(campo):
                por_mail.setdefault(c[campo].strip().lower(), []).append(c)
        for campo in ("telefono", "telefono_2", "telefono_fijo"):
            d = solo_digitos(c.get(campo))
            if d:
                por_tel.setdefault(d, []).append(c)

    salida = []
    for p in personas:
        pila = norm(p["nombres"])
        apes = set(norm(p["apellidos"]) + norm(p.get("apellidoNacimiento")))
        apodo = set(norm(p.get("apodo")))
        if not pila or not apes:
            continue

        vistos, cands = set(), []

        def sumar(c, puntaje, motivo):
            if c["id"] in vistos:
                return
            vistos.add(c["id"])
            cands.append({"contacto": c, "puntaje": round(puntaje, 3), "motivo": motivo})

        for c in por_mail.get((p.get("email") or "").strip().lower(), []):
            sumar(c, 1.0, "mismo correo")
        for campo in ("celular",):
            for c in por_tel.get(solo_digitos(p.get(campo)), []):
                sumar(c, 1.0, "mismo teléfono")

        for c in contactos:
            suyas = norm(c["nombre_completo"]) or norm(f"{c.get('nombre','')} {c.get('apellido','')}")
            if not suyas:
                continue
            if not any(parecidas(a, s) for a in apes for s in suyas):
                continue
            pilas = sum(1 for n in pila if any(parecidas(n, s) for s in suyas))
            if not pilas and not any(parecidas(a, s) for a in apodo for s in suyas):
                continue           # comparte apellido pero ningún nombre: es un homónimo
            apellidos_ok = sum(1 for a in apes if any(parecidas(a, s) for s in suyas))
            # Cuánto de lo que sé de la persona aparece en el contacto, y al revés.
            mios = len(pila) + len(apes)
            puntaje = 0.6 * ((pilas + apellidos_ok) / mios) + 0.4 * ((pilas + apellidos_ok) / len(suyas))
            sumar(c, puntaje, f"{pilas} nombre(s) y {apellidos_ok} apellido(s)")

        cands.sort(key=lambda x: -x["puntaje"])
        if cands:
            salida.append({"persona": p, "candidatos": cands[:8]})
    return salida


if __name__ == "__main__":
    personas = cargar_arbol()
    apellidos = {w for p in personas for w in norm(p["apellidos"]) + norm(p.get("apellidoNacimiento")) if len(w) >= 4}
    contactos = candidatos_del_crm(apellidos)
    print(f"{len(personas)} personas · {len(contactos)} contactos con apellido en común")
    res = cotejar(personas, contactos)
    fuertes = [r for r in res if r["candidatos"][0]["puntaje"] >= 0.75]
    print(f"{len(res)} personas con algún candidato · {len(fuertes)} con uno fuerte (>=0.75)\n")
    for r in sorted(res, key=lambda r: -r["candidatos"][0]["puntaje"])[:25]:
        p = r["persona"]
        print(f"{p['nombres']} {p['apellidos']}")
        for c in r["candidatos"][:3]:
            k = c["contacto"]
            print(f"   {c['puntaje']:.2f} {k['nombre_completo']!r} · {k.get('email') or '—'} · {k.get('telefono') or '—'} · {k.get('ciudad') or '—'} · {k['fuente_sistema']}")
