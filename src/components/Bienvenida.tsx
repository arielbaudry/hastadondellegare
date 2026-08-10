"use client";

import { useMemo, useState } from "react";
import Retrato from "@/components/Retrato";
import { anio, nombreCompleto, ordenarPorNacimiento } from "@/lib/tree";
import { buscarPersona, esInequivoca } from "@/lib/coincidencias";
import type { Persona } from "@/lib/types";

/** Vínculo con el que alguien nuevo se engancha al árbol. */
export type TipoEnganche = "hijo" | "padre" | "pareja" | "hermano" | "nieto" | "sobrino";

export interface AltaPropia {
  nombres: string;
  apellidos: string;
  enganche: { tipo: TipoEnganche; personaId: string };
}

const ENGANCHES: { tipo: TipoEnganche; etiqueta: string }[] = [
  { tipo: "hijo", etiqueta: "soy hijo/a de" },
  { tipo: "padre", etiqueta: "soy padre/madre de" },
  { tipo: "hermano", etiqueta: "soy hermano/a de" },
  { tipo: "pareja", etiqueta: "soy pareja de" },
  { tipo: "nieto", etiqueta: "soy nieto/a de" },
  { tipo: "sobrino", etiqueta: "soy sobrino/a de" },
];

/**
 * Se pregunta una sola vez, la primera. Tres pasos, y sólo los que hagan falta:
 *
 *  1. el nombre — que además firma cada ficha y aparece en los conectados;
 *  2. si se parece a más de una persona del árbol, cuál es;
 *  3. si no está en el árbol, con quién está emparentado, para crear su ficha.
 */
export default function Bienvenida({
  personas,
  onListo,
  onAlta,
}: {
  personas: Persona[];
  onListo: (nombre: string, personaId: string | null) => void;
  onAlta: (datos: AltaPropia) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [paso, setPaso] = useState<"nombre" | "elegir" | "alta">("nombre");
  const [candidatos, setCandidatos] = useState<Persona[]>([]);
  const [apellidos, setApellidos] = useState("");
  const [tipo, setTipo] = useState<TipoEnganche>("hijo");
  const [conQuien, setConQuien] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gente = useMemo(() => ordenarPorNacimiento(personas), [personas]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const texto = nombre.trim();
    if (!texto) return;

    const encontrados = buscarPersona(texto, personas);
    if (esInequivoca(encontrados)) {
      onListo(texto, encontrados[0].persona.id);
      return;
    }
    if (encontrados.length) {
      setCandidatos(encontrados.map((c) => c.persona));
      setPaso("elegir");
      return;
    }
    irAlAlta();
  }

  /** El apellido se propone a partir de lo escrito, venga de donde venga: si
   *  queda vacío, el campo obligatorio bloquea el envío sin decir por qué. */
  function irAlAlta() {
    const partes = nombre.trim().split(/\s+/);
    if (!apellidos && partes.length > 1) setApellidos(partes.slice(-1)[0]);
    setPaso("alta");
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!conQuien) return;
    setGuardando(true);
    setError(null);
    try {
      const partes = nombre.trim().split(/\s+/);
      await onAlta({
        nombres: partes.length > 1 ? partes.slice(0, -1).join(" ") : nombre.trim(),
        apellidos: apellidos.trim() || partes.slice(-1)[0],
        enganche: { tipo, personaId: conQuien },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ficha.");
      setGuardando(false);
    }
  }

  return (
    <div className="telon" style={{ zIndex: 70 }}>
      <div className="modal bienvenida" role="dialog" aria-modal="true" aria-label="¿Quién sos?">
        <div className="cuerpo">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="30" height="30">
              <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M16 25v-4M9 17v-2h14v2M9 15v-3M23 15v-3M16 21v-6" />
              </g>
              <g fill="currentColor">
                <circle cx="9" cy="9" r="3" />
                <circle cx="23" cy="9" r="3" />
                <circle cx="16" cy="27" r="3" />
              </g>
            </svg>
          </span>

          {paso === "nombre" && (
            <>
              <h2>¿Cómo te llamás?</h2>
              <p className="prosa">
                Para abrirte el árbol en tu ficha, para que cada cosa que cargues quede
                firmada, y para que el resto sepa que estás mirando. Queda guardado en este
                navegador; no es una contraseña.
              </p>
              <form onSubmit={buscar}>
                <input
                  className="campo-texto"
                  autoFocus
                  required
                  placeholder="Nombre y apellido"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <button className="btn primario" type="submit" disabled={!nombre.trim()}>
                  Entrar al árbol
                </button>
              </form>
            </>
          )}

          {paso === "elegir" && (
            <>
              <h2>¿Cuál de estas sos?</h2>
              <p className="prosa">
                Hay más de una persona que se parece a «{nombre.trim()}». Elegí la tuya para
                que el árbol se abra ahí.
              </p>
              <div className="opciones-persona">
                {candidatos.map((p) => (
                  <button key={p.id} className="tarjeta" onClick={() => onListo(nombre.trim(), p.id)}>
                    <Retrato persona={p} clase="retrato" />
                    <span style={{ minWidth: 0 }}>
                      <span className="nom" style={{ display: "block" }}>{nombreCompleto(p)}</span>
                      <span className="met" style={{ display: "block" }}>
                        {anio(p.fechaNacimiento) ? `n. ${anio(p.fechaNacimiento)}` : "sin fecha"}
                        {p.lugarNacimiento ? ` · ${p.lugarNacimiento}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button className="btn" onClick={irAlAlta}>
                  Ninguna, todavía no estoy en el árbol
                </button>
                <button className="btn fantasma" onClick={() => onListo(nombre.trim(), null)}>
                  Sólo quiero mirar
                </button>
              </div>
            </>
          )}

          {paso === "alta" && (
            <>
              <h2>Todavía no estás en el árbol</h2>
              <p className="prosa">
                Creemos tu ficha. Decinos con quién de la familia estás emparentado —el
                pariente más cercano que ya esté cargado— y de qué manera.
              </p>
              <form onSubmit={crear}>
                <div className="campos">
                  <div className="campo">
                    <label htmlFor="b-nombres">Tus nombres</label>
                    <input
                      id="b-nombres"
                      className="campo-texto"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="b-apellidos">Tus apellidos</label>
                    <input
                      id="b-apellidos"
                      className="campo-texto"
                      required
                      placeholder="Labianca"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="b-tipo">Vínculo</label>
                    <select id="b-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEnganche)}>
                      {ENGANCHES.map((x) => (
                        <option key={x.tipo} value={x.tipo}>{x.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor="b-quien">¿De quién?</label>
                    <select id="b-quien" required value={conQuien} onChange={(e) => setConQuien(e.target.value)}>
                      <option value="">— elegí a la persona —</option>
                      {gente.map((p) => (
                        <option key={p.id} value={p.id}>
                          {nombreCompleto(p)}
                          {anio(p.fechaNacimiento) ? ` (${anio(p.fechaNacimiento)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="ayuda" style={{ marginTop: 12 }}>
                  ¿El parentesco es más lejano? Por ejemplo, sobrino nieto: cargate primero
                  como hijo/a de tu papá o tu mamá, y si esa persona tampoco está, creala a
                  ella primero. El árbol se arma de a un eslabón.
                </p>

                {error && <div className="error">{error}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <button className="btn primario" type="submit" disabled={guardando || !conQuien}>
                    {guardando ? "Creando…" : "Crear mi ficha y entrar"}
                  </button>
                  <button
                    type="button"
                    className="btn fantasma"
                    onClick={() => onListo(nombre.trim(), null)}
                  >
                    Después la creo
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
