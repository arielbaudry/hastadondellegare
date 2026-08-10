"use client";

import { useState } from "react";
import { nombreCompleto, ordenarPorNacimiento } from "@/lib/tree";
import type { Persona } from "@/lib/types";

/**
 * Se pregunta una sola vez, la primera. No es un login ni pretende serlo: es
 * para que cada ficha diga quién la cargó y quién la corrigió, y para saber
 * quién está mirando el árbol en este momento.
 *
 * Ofrece los nombres ya cargados, que es lo más probable: quien entra suele
 * estar en el árbol.
 */
export default function Bienvenida({
  personas,
  onListo,
}: {
  personas: Persona[];
  onListo: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState("");

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

          <h2>¿Cómo te llamás?</h2>
          <p className="prosa">
            Para que cada ficha diga quién la cargó y quién la corrigió, y para que el resto
            de la familia sepa que estás mirando el árbol. Queda guardado en este navegador;
            no es una contraseña ni te vamos a pedir nada más.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim()) onListo(nombre.trim());
            }}
          >
            <input
              className="campo-texto"
              list="personas-cargadas"
              autoFocus
              required
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <datalist id="personas-cargadas">
              {ordenarPorNacimiento(personas).map((p) => (
                <option key={p.id} value={nombreCompleto(p)} />
              ))}
            </datalist>

            <button className="btn primario" type="submit" disabled={!nombre.trim()}>
              Entrar al árbol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
