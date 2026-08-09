"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Campo de fecha con dos formas de cargar:
 *
 *  - escribiendo, que admite fechas incompletas — `1948`, `1948-03`,
 *    `1948-03-27` — porque de los ancestros lejanos rara vez se sabe el día;
 *  - con el calendario del sistema, para las fechas que sí se saben enteras.
 *
 * El calendario NO reemplaza al texto: escribe en él. Un `<input type="date">`
 * solo no serviría, porque obliga a una fecha completa y perdería la mitad de
 * los datos de un árbol genealógico.
 */
export default function CampoFecha({
  id,
  valor,
  onCambio,
  autoFocus,
}: {
  id: string;
  valor: string;
  onCambio: (valor: string) => void;
  autoFocus?: boolean;
}) {
  const [calendario, setCalendario] = useState(false);
  const nativo = useRef<HTMLInputElement>(null);

  const completa = /^\d{4}-\d{2}-\d{2}$/.test(valor);

  // Al abrirlo, se intenta desplegar el almanaque directamente. Donde el
  // navegador no lo permita queda el campo visible, que funciona igual.
  useEffect(() => {
    if (!calendario) return;
    const el = nativo.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      /* Safari y algunos móviles no lo permiten: se usa el campo a mano. */
    }
  }, [calendario]);

  return (
    <div className="campo-fecha">
      <input
        id={id}
        className="campo-texto"
        placeholder="AAAA, AAAA-MM o AAAA-MM-DD"
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
      <button
        type="button"
        className="btn chico boton-calendario"
        aria-label={calendario ? "Cerrar el calendario" : "Elegir la fecha en un calendario"}
        aria-expanded={calendario}
        title="Elegir en un calendario"
        onClick={() => setCalendario((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {calendario && (
        <input
          ref={nativo}
          type="date"
          className="campo-texto nativo-fecha"
          aria-label="Calendario"
          value={completa ? valor : ""}
          onChange={(e) => {
            if (!e.target.value) return;
            onCambio(e.target.value);
            setCalendario(false);
          }}
        />
      )}
    </div>
  );
}
