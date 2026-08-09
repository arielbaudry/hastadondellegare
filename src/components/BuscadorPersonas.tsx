"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Retrato from "@/components/Retrato";
import { anio, nombreCompleto, ordenarPorNacimiento } from "@/lib/tree";
import type { Persona } from "@/lib/types";

/** Busca sin acentos: "jose" tiene que encontrar a "José". */
function plano(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Buscador del encabezado: escribir un nombre y saltar directo a esa persona,
 * sin tener que ir a la pestaña Personas y volver. Con teclado (↑ ↓ Enter) y
 * con Ctrl/⌘+K desde cualquier lado.
 */
export default function BuscadorPersonas({
  personas,
  onElegir,
}: {
  personas: Persona[];
  onElegir: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const t = plano(q.trim());
    if (!t) return [];
    return ordenarPorNacimiento(
      personas.filter((p) =>
        plano([p.nombres, p.apellidos, p.apodo, p.apellidoNacimiento].filter(Boolean).join(" ")).includes(t),
      ),
    ).slice(0, 8);
  }, [q, personas]);

  useEffect(() => setActivo(0), [q]);

  // Atajo global.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campo.current?.focus();
        campo.current?.select();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, []);

  function elegir(p: Persona) {
    onElegir(p.id);
    setQ("");
    setAbierto(false);
    campo.current?.blur();
  }

  return (
    <div className="buscador" ref={caja}>
      <svg className="lupa" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={campo}
        className="campo-texto"
        placeholder="Buscar a alguien…"
        aria-label="Buscar una persona del árbol"
        aria-expanded={abierto && resultados.length > 0}
        role="combobox"
        aria-controls="resultados-buscador"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            setAbierto(false);
            return;
          }
          if (!resultados.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActivo((i) => (i + 1) % resultados.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActivo((i) => (i - 1 + resultados.length) % resultados.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(resultados[activo]);
          }
        }}
      />
      {!q && <kbd className="atajo">⌘K</kbd>}

      {abierto && q.trim() !== "" && (
        <ul className="resultados" id="resultados-buscador" role="listbox">
          {resultados.length === 0 ? (
            <li className="sin-resultados">Nadie con ese nombre todavía.</li>
          ) : (
            resultados.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === activo}>
                <button
                  className={i === activo ? "activo" : undefined}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(p)}
                >
                  <Retrato persona={p} clase="mini" />
                  <span className="nom">{nombreCompleto(p)}</span>
                  <span className="met">
                    {anio(p.fechaNacimiento) ? `n. ${anio(p.fechaNacimiento)}` : "sin fecha"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
