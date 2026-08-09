"use client";

import { useMemo } from "react";
import { nombreCompleto } from "@/lib/tree";
import { resumen, revisar, type Gravedad, type Hallazgo } from "@/lib/revision";
import type { Persona } from "@/lib/types";

const ETIQUETA: Record<Gravedad, string> = {
  error: "Errores",
  aviso: "Para revisar",
  sugerencia: "Para completar",
};

const EXPLICACION: Record<Gravedad, string> = {
  error: "Datos que no pueden ser ciertos: hacen que el árbol muestre cosas que no son.",
  aviso: "Puede estar bien o puede faltar algo; sólo vos sabés. Mirá cada una y decidí.",
  sugerencia: "Nada roto: es lo que falta averiguar o completar.",
};

export default function Revision({
  personas,
  onFoco,
}: {
  personas: Persona[];
  onFoco: (id: string) => void;
}) {
  const hallazgos = useMemo(() => revisar(personas), [personas]);
  const cuenta = resumen(hallazgos);

  const porGravedad = (g: Gravedad) => hallazgos.filter((h) => h.gravedad === g);

  if (!personas.length) {
    return <div className="vacio">Todavía no hay nada que revisar.</div>;
  }

  return (
    <div className="hoja">
      <div className="hoja-ancho" style={{ maxWidth: 900 }}>
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Revisión del árbol</h2>
        <p className="prosa" style={{ color: "var(--tinta-suave)", marginTop: 0 }}>
          Todo lo que no cierra, junto y en un solo lado: fechas que no pueden ser, vínculos
          cargados de un lado solo, personas que quedaron sueltas, fichas repetidas. Lo que
          falta —un padre, una fecha— no se avisa: puede que no se sepa, o que no se quiera
          cargar, y eso lo decide cada uno desde la ficha.
        </p>

        <div className="metricas" style={{ marginTop: 20 }}>
          <div className="metrica">
            <div className="n" style={{ color: cuenta.errores ? "var(--alerta)" : undefined }}>
              {cuenta.errores}
            </div>
            <div className="e">errores</div>
          </div>
          <div className="metrica">
            <div className="n" style={{ color: cuenta.avisos ? "var(--aviso)" : undefined }}>
              {cuenta.avisos}
            </div>
            <div className="e">para revisar</div>
          </div>
          <div className="metrica">
            <div className="n">{cuenta.sugerencias}</div>
            <div className="e">para completar</div>
          </div>
        </div>

        {hallazgos.length === 0 && (
          <div className="vacio">
            <h2>El árbol está impecable</h2>
            <p>No encontré nada raro: ni vínculos a medias, ni fechas imposibles.</p>
          </div>
        )}

        {(["error", "aviso", "sugerencia"] as Gravedad[]).map((g) => {
          const grupo = porGravedad(g);
          if (!grupo.length) return null;
          return (
            <div className="seccion-form" key={g}>
              <h3>
                {ETIQUETA[g]} ({grupo.length})
              </h3>
              <p>{EXPLICACION[g]}</p>
              <ul className="hallazgos">
                {grupo.map((h, i) => (
                  <li key={`${h.tipo}-${h.personas.join("-")}-${i}`} className={`hallazgo ${g}`}>
                    <div className="cuerpo">
                      <strong>{h.titulo}</strong>
                      <p>{h.detalle}</p>
                      <div className="chips">
                        {h.personas.map((id) => {
                          const p = personas.find((x) => x.id === id);
                          if (!p) return null;
                          return (
                            <button key={id} className="chip" onClick={() => onFoco(id)}>
                              {nombreCompleto(p)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function contarErrores(personas: Persona[]): number {
  return revisar(personas).filter((h) => h.gravedad === "error").length;
}

export type { Hallazgo };
