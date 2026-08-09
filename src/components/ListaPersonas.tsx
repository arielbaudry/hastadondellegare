"use client";

import { useMemo, useState } from "react";
import Retrato from "@/components/Retrato";
import { anio, lineaVida, metricas, nombreCompleto, ordenarPorNacimiento } from "@/lib/tree";
import type { Persona } from "@/lib/types";

type Filtro = "todos" | "vivos" | "fallecidos" | "sin-foto" | "sin-padres";

/** Busca sin acentos: "jose" tiene que encontrar a "José". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function ListaPersonas({
  personas,
  onFoco,
  onEditar,
  onNueva,
}: {
  personas: Persona[];
  /** Ir al árbol centrado en esa persona. */
  onFoco: (id: string) => void;
  /** Abrir la ficha para editarla: es la acción principal de la tarjeta. */
  onEditar: (p: Persona) => void;
  onNueva: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const m = useMemo(() => metricas(personas), [personas]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return ordenarPorNacimiento(
      personas.filter((p) => {
        if (filtro === "vivos" && !p.vivo) return false;
        if (filtro === "fallecidos" && p.vivo) return false;
        if (filtro === "sin-foto" && p.fotos?.length) return false;
        if (filtro === "sin-padres" && p.padres.length) return false;
        if (!q) return true;
        const heno = normalizar(
          [p.nombres, p.apellidos, p.apodo, p.apellidoNacimiento, p.lugarNacimiento, p.notas]
            .filter(Boolean)
            .join(" "),
        );
        return heno.includes(q);
      }),
    );
  }, [personas, busqueda, filtro]);

  return (
    <div className="hoja">
      <div className="hoja-ancho">
        <div className="metricas">
          <div className="metrica">
            <div className="n">{m.total}</div>
            <div className="e">personas</div>
          </div>
          <div className="metrica">
            <div className="n">{m.generacionesArriba}</div>
            <div className="e">generaciones atrás</div>
          </div>
          <div className="metrica">
            <div className="n">{m.anioMasAntiguo ?? "—"}</div>
            <div className="e">nacimiento más antiguo</div>
          </div>
          <div className="metrica">
            <div className="n">
              {m.vivos}
              <span style={{ fontSize: 16, color: "var(--tinta-tenue)" }}> / {m.fallecidos}</span>
            </div>
            <div className="e">viven / fallecieron</div>
          </div>
          <div className="metrica">
            <div className="n">{m.conFoto}</div>
            <div className="e">con foto</div>
          </div>
        </div>

        {m.frontera.length > 0 && (
          <div className="seccion-form" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            <h3>Hasta acá llegamos</h3>
            <p>
              Personas ya fallecidas de las que todavía no cargamos padres. Cada una es una
              punta abierta del árbol: si alguien de la familia sabe algo, es acá donde suma.
            </p>
            <ul className="lista-simple">
              {m.frontera.map((p) => (
                <li key={p.id}>
                  <button className="btn chico fantasma" onClick={() => onFoco(p.id)}>
                    {nombreCompleto(p)}
                  </button>
                  <span style={{ color: "var(--tinta-tenue)", fontSize: 12.5 }}>
                    {anio(p.fechaNacimiento) ?? "año desconocido"}
                    {p.lugarNacimiento ? ` · ${p.lugarNacimiento}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="barra-busqueda" style={{ marginTop: 26 }}>
          <input
            className="campo-texto"
            placeholder="Buscar por nombre, apodo, lugar o nota…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            style={{ width: "auto" }}
          >
            <option value="todos">Todas</option>
            <option value="vivos">Viven</option>
            <option value="fallecidos">Fallecieron</option>
            <option value="sin-foto">Sin foto</option>
            <option value="sin-padres">Sin padres cargados</option>
          </select>
          <button className="btn primario" onClick={onNueva}>
            + Agregar persona
          </button>
        </div>

        {visibles.length === 0 ? (
          <div className="vacio">Ninguna persona coincide con la búsqueda.</div>
        ) : (
          <div className="rejilla">
            {visibles.map((p) => (
              // La tarjeta no es un <button> porque lleva dos acciones adentro y
              // los botones no se pueden anidar.
              <article key={p.id} className="tarjeta">
                <button
                  className="tarjeta-abrir"
                  onClick={() => onEditar(p)}
                  title={`Editar la ficha de ${nombreCompleto(p)}`}
                >
                  <Retrato persona={p} clase="retrato" />
                  <span style={{ minWidth: 0 }}>
                    <span className="nom" style={{ display: "block" }}>
                      {nombreCompleto(p)}
                    </span>
                    <span className="met" style={{ display: "block" }}>
                      {lineaVida(p) || "sin fechas"}
                    </span>
                    {p.lugarNacimiento && (
                      <span className="met" style={{ display: "block" }}>
                        {p.lugarNacimiento}
                      </span>
                    )}
                  </span>
                </button>

                <button
                  className="tarjeta-arbol"
                  onClick={() => onFoco(p.id)}
                  title={`Ver el árbol desde ${nombreCompleto(p)}`}
                  aria-label={`Ver el árbol desde ${nombreCompleto(p)}`}
                >
                  <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
                    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
                      <path d="M10 16.5v-3M5.5 10.5v-1.5h9v1.5M5.5 9v-2M14.5 9v-2M10 13.5v-4.5" />
                    </g>
                    <g fill="currentColor">
                      <circle cx="5.5" cy="5" r="2" />
                      <circle cx="14.5" cy="5" r="2" />
                      <circle cx="10" cy="18" r="2" />
                    </g>
                  </svg>
                </button>
              </article>
            ))}
          </div>
        )}

        {m.apellidos.length > 0 && (
          <div className="seccion-form">
            <h3>Apellidos en el árbol</h3>
            <div className="chips">
              {m.apellidos.map((a) => (
                <span className="pastilla" key={a.apellido}>
                  {a.apellido} · {a.cuantos}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
