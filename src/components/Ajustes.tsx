"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nombreCompleto } from "@/lib/tree";
import { leerClaveAdmin } from "@/lib/cliente";
import type { EstadoAlmacenamiento, Movimiento, Permisos, Sesion } from "@/lib/cliente";
import type { Persona } from "@/lib/types";

type Tema = "sistema" | "claro" | "oscuro";

const ETIQUETA_ACCION: Record<string, string> = {
  entro: "entró",
  alta: "cargó a",
  edicion: "corrigió a",
  baja: "eliminó a",
  deshacer: "deshizo el último cambio",
  importar: "reemplazó el árbol",
};

function aplicarTema(t: Tema) {
  const raiz = document.documentElement;
  if (t === "sistema") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", t);
  window.localStorage.setItem("hdll:tema", t);
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const COLUMNAS = [
  "id", "nombres", "apellidos", "apodo", "apellidoNacimiento", "fechaNacimiento",
  "lugarNacimiento", "vivo", "fechaFallecimiento", "celular", "email", "direccion",
  "padres", "parejas", "notas",
] as const;

function aCsv(personas: Persona[]): string {
  const escapar = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = personas.map((p) =>
    COLUMNAS.map((c) => {
      if (c === "padres") return escapar(p.padres.join(" "));
      if (c === "parejas") return escapar(p.parejas.map((v) => `${v.personaId}:${v.tipo}`).join(" "));
      return escapar(p[c as keyof Persona]);
    }).join(","),
  );
  return `﻿${COLUMNAS.join(",")}\n${filas.join("\n")}`;
}

export default function Ajustes({
  personas,
  esEjemplo,
  almacenamiento,
  permisos,
  bitacora,
  sesion,
  onSalir,
  onProbarClave,
  autor,
  onAutor,
  onDeshacer,
  onSembrar,
  onImportar,
}: {
  personas: Persona[];
  esEjemplo: boolean;
  almacenamiento: EstadoAlmacenamiento | null;
  permisos: Permisos;
  bitacora: Movimiento[];
  sesion: Sesion | null;
  onSalir: () => void;
  onProbarClave: (clave: string) => Promise<boolean>;
  autor: string;
  onAutor: (nombre: string) => void;
  onDeshacer: () => void;
  onSembrar: (accion: "ejemplo" | "vaciar") => void;
  onImportar: (personas: unknown[]) => void;
}) {
  const [tema, setTema] = useState<Tema>("sistema");
  const [clave, setClave] = useState("");
  const [probando, setProbando] = useState(false);
  const [avisoClave, setAvisoClave] = useState<string | null>(null);
  const [verBitacora, setVerBitacora] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  /** Quiénes movieron el árbol y cuánto, del que más al que menos. */
  const quienes = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const m of bitacora) cuenta.set(m.quien, (cuenta.get(m.quien) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  }, [bitacora]);

  useEffect(() => {
    setTema((window.localStorage.getItem("hdll:tema") as Tema) ?? "claro");
    setClave(leerClaveAdmin());
  }, []);

  return (
    <div className="hoja">
      <div className="hoja-ancho" style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Ajustes</h2>
        <p className="prosa" style={{ color: "var(--tinta-suave)", marginTop: 0 }}>
          Todo lo que se carga acá queda en el árbol compartido: lo ve cualquiera que tenga el
          link. Mientras dure el modo abierto no hay usuarios ni contraseñas, así que lo único
          que identifica a quien edita es el nombre que declares abajo.
        </p>

        {sesion && (
          <div className="seccion-form" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <h3>Tu acceso</h3>
            <p>
              Entraste como <strong>{sesion.email}</strong> —{" "}
              {sesion.rol === "admin"
                ? "administrador: podés eliminar y restaurar respaldos."
                : "colaborador: podés sumar personas y corregir datos, pero no eliminar."}
            </p>
            <button className="btn chico" onClick={onSalir}>
              Cerrar sesión en este navegador
            </button>
          </div>
        )}

        <div className="seccion-form">
          <h3>Tu nombre</h3>
          <p>Queda guardado en este navegador y se anota en cada persona que cargues.</p>
          <input
            className="campo-texto"
            placeholder="Cómo te llamás"
            value={autor}
            onChange={(e) => onAutor(e.target.value)}
          />
        </div>

        <div className="seccion-form">
          <h3>Tema</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {(["sistema", "claro", "oscuro"] as Tema[]).map((t) => (
              <button
                key={t}
                className={`btn chico${tema === t ? " primario" : ""}`}
                onClick={() => {
                  setTema(t);
                  aplicarTema(t);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="seccion-form">
          <h3>Quién hizo qué</h3>
          <p>
            Últimos movimientos del árbol: quién entró y quién cargó o corrigió a quién. Se
            guardan los 300 más recientes, junto con el árbol.
          </p>
          {bitacora.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--tinta-tenue)" }}>Todavía no hay movimientos.</p>
          ) : (
            <>
              <div className="chips" style={{ marginBottom: 12 }}>
                {quienes.slice(0, 12).map(([quien, cuantos]) => (
                  <span className="pastilla" key={quien}>
                    {quien} · {cuantos}
                  </span>
                ))}
              </div>
              {/* La lista entera no va acá: son cientos de líneas y estiran la
                  pantalla de Ajustes hasta romperla. Se abre aparte. */}
              <button className="btn" onClick={() => setVerBitacora(true)}>
                Ver el registro ({bitacora.length})
              </button>
            </>
          )}
        </div>

        {verBitacora && (
          <div className="telon" onMouseDown={(e) => e.target === e.currentTarget && setVerBitacora(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Quién hizo qué">
              <header>
                <h2>Quién hizo qué</h2>
                <button className="btn chico fantasma" onClick={() => setVerBitacora(false)}>
                  Cerrar
                </button>
              </header>
              <div className="cuerpo">
                <div className="chips" style={{ marginBottom: 14 }}>
                  {quienes.map(([quien, cuantos]) => (
                    <span className="pastilla" key={quien}>
                      {quien} · {cuantos}
                    </span>
                  ))}
                </div>
                <ul className="bitacora">
                  {bitacora.map((m, i) => (
                    <li key={`${m.cuando}-${i}`}>
                      <span className="cuando">
                        {new Date(m.cuando).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <strong>{m.quien}</strong>
                      <span className={`accion ${m.accion}`}>
                        {ETIQUETA_ACCION[m.accion] ?? m.accion}
                      </span>
                      {m.detalle && <span className="detalle">{m.detalle}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="seccion-form">
          <h3>Deshacer</h3>
          <p>
            Vuelve el árbol a como estaba justo antes del último cambio — de cualquiera, no
            sólo tuyo. Sirve cuando alguien borró o pisó algo sin querer. Se guarda un solo
            paso atrás, así que conviene usarlo enseguida.
          </p>
          <button
            className="btn"
            onClick={() => {
              if (window.confirm("Se descarta el último cambio hecho en el árbol. ¿Seguimos?")) {
                onDeshacer();
              }
            }}
          >
            Deshacer el último cambio
          </button>
        </div>

        <div className="seccion-form">
          <h3>Respaldos</h3>
          <p>
            Descargá una copia cada tanto. El JSON sirve para restaurar tal cual; el CSV, para
            abrirlo en una planilla. Restaurar reemplaza todo, así que necesita la clave.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={() =>
                descargar(
                  `arbol-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify({ personas }, null, 2),
                  "application/json",
                )
              }
            >
              Exportar JSON
            </button>
            <button
              className="btn"
              onClick={() =>
                descargar(
                  `arbol-${new Date().toISOString().slice(0, 10)}.csv`,
                  aCsv(personas),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Exportar CSV
            </button>
            <input
              ref={archivo}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const datos = JSON.parse(await f.text());
                  const lista = Array.isArray(datos) ? datos : datos.personas;
                  if (!Array.isArray(lista)) throw new Error("sin lista de personas");
                  if (
                    window.confirm(
                      `Vas a reemplazar las ${personas.length} personas actuales por las ${lista.length} del archivo. ¿Seguimos?`,
                    )
                  ) {
                    onImportar(lista);
                  }
                } catch {
                  window.alert("Ese archivo no parece un respaldo válido.");
                }
                e.target.value = "";
              }}
            />
            {permisos.puedeBorrar && (
              <button className="btn" onClick={() => archivo.current?.click()}>
                Importar JSON
              </button>
            )}
          </div>
        </div>

        <div className="seccion-form">
          <h3>Nada se borra</h3>
          <p className="prosa">
            Mientras el árbol esté abierto, <strong>nadie puede eliminar personas</strong> —
            ni vos desde acá. Se puede sumar y se puede corregir: si alguien carga algo mal,
            se edita. Lo único que no tiene arreglo es perder lo que cargó otro, y con
            veinte parientes escribiendo sin contraseña ese es el riesgo real.
          </p>
          {permisos.restringido ? (
            <p style={{ fontSize: 13, color: "var(--tinta-suave)" }}>
              {permisos.puedeBorrar
                ? "Sos el administrador: en las fichas te aparece el botón de eliminar."
                : "Eliminar queda reservado al administrador del árbol."}
            </p>
          ) : permisos.puedeBorrar ? (
            <p style={{ color: "var(--alerta)", fontSize: 13 }}>
              Este navegador tiene la clave de administración: acá sí aparecen las acciones
              de eliminar. Cerrá sesión abajo si no las vas a usar.
            </p>
          ) : (
            <div className="campos" style={{ maxWidth: 460 }}>
              <div className="campo ancho">
                <label htmlFor="f-clave">Clave de administración</label>
                <input
                  id="f-clave"
                  className="campo-texto"
                  type="password"
                  autoComplete="off"
                  placeholder={!permisos.restringido ? "sólo para el dueño del árbol" : "no configurada en este servidor"}
                  disabled={!!permisos.restringido || probando}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
                <span className="ayuda">
                  {!permisos.restringido
                    ? "Habilita eliminar personas y restaurar respaldos. No se comparte con nadie."
                    : "Sin ADMIN_CLAVE configurada, borrar está deshabilitado para todos."}
                </span>
              </div>
              <div className="campo">
                <button
                  className="btn"
                  disabled={!!permisos.restringido || !clave || probando}
                  onClick={async () => {
                    setProbando(true);
                    setAvisoClave(null);
                    const ok = await onProbarClave(clave);
                    setProbando(false);
                    if (!ok) setAvisoClave("Esa clave no es.");
                  }}
                >
                  {probando ? "Comprobando…" : "Desbloquear"}
                </button>
              </div>
            </div>
          )}
          {avisoClave && <div className="error">{avisoClave}</div>}
          {permisos.puedeBorrar && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button
                className="btn chico"
                onClick={async () => {
                  await onProbarClave("");
                  setClave("");
                }}
              >
                Cerrar la sesión de administración
              </button>
              {esEjemplo && (
                <button className="btn chico" onClick={() => onSembrar("ejemplo")}>
                  Recargar familia de ejemplo
                </button>
              )}
            </div>
          )}
        </div>

        <div className="seccion-form">
          <h3>Dónde se guarda</h3>
          {almacenamiento ? (
            <ul className="lista-simple">
              <li>
                Se guarda en: <strong>{almacenamiento.driver}</strong>
              </li>
              <li>
                Persistencia:{" "}
                <strong>{almacenamiento.persistente ? "los datos sobreviven al reinicio" : "efímera"}</strong>
              </li>
              <li>Personas cargadas: <strong>{personas.length}</strong></li>
            </ul>
          ) : (
            <p>—</p>
          )}
          {almacenamiento?.advertencia && <div className="error">{almacenamiento.advertencia}</div>}
        </div>

        <div className="seccion-form">
          <h3>Lo que viene</h3>
          <p className="prosa">
            Cuando la familia haya cargado lo grueso, se cierra el modo abierto: cada persona
            con correo cargado recibe un <em>magic link</em> —un enlace de un solo uso, sin
            contraseña— y a partir de ahí sólo edita quien entró por su enlace. Los datos de
            contacto dejan de verse para el público general.
          </p>
          {personas.filter((p) => p.email).length > 0 && (
            <>
              <p style={{ fontSize: 12.5, color: "var(--tinta-tenue)" }}>
                Correos ya cargados, que serán los primeros invitados:
              </p>
              <ul className="lista-simple">
                {personas
                  .filter((p) => p.email)
                  .map((p) => (
                    <li key={p.id}>
                      {nombreCompleto(p)} — {p.email}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
