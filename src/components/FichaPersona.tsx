"use client";

import { useEffect, useMemo, useState } from "react";
import {
  abuelosDe,
  edad,
  formatearFecha,
  fotoPrincipal,
  hijosDe,
  indexar,
  nietosDe,
  nombreCompleto,
  padresDe,
  parejasDe,
  primosDe,
  sobrinosDe,
  tiosDe,
  type Indice,
} from "@/lib/tree";
import Retrato, { iniciales } from "@/components/Retrato";
import { linajeDe } from "@/lib/parentesco";
import type { Persona } from "@/lib/types";

export type TipoVinculo = "padre" | "hijo" | "pareja" | "hermano";

interface Props {
  persona: Persona;
  personas: Persona[];
  onFoco: (id: string) => void;
  onEditar: () => void;
  onAgregar: (tipo: TipoVinculo) => void;
  /** Sin la clave de administración nadie borra: se corrige, no se elimina. */
  puedeBorrar: boolean;
  onBorrar: () => void;
}

/**
 * Visor de las fotos de la persona. Todas las que haya subido la familia: la
 * grande arriba y las demás como miniaturas para ir pasando. Nadie pisa la
 * foto de nadie.
 */
function Visor({ persona }: { persona: Persona }) {
  const fotos = persona.fotos ?? [];
  const [i, setI] = useState(0);

  // Al cambiar de persona se vuelve a la primera foto.
  useEffect(() => setI(0), [persona.id]);

  if (!fotos.length) {
    return (
      <span className="retrato grande" aria-hidden="true">
        {iniciales(persona)}
      </span>
    );
  }

  return (
    <div className="visor">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="retrato grande"
        src={fotos[Math.min(i, fotos.length - 1)]}
        alt={`Foto de ${nombreCompleto(persona)}`}
      />
      {fotos.length > 1 && (
        <div className="visor-tiras">
          {fotos.map((url, j) => (
            <button
              key={url}
              className={`visor-tira${j === i ? " activa" : ""}`}
              onClick={() => setI(j)}
              aria-label={`Ver la foto ${j + 1} de ${fotos.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ p, onFoco }: { p: Persona; onFoco: (id: string) => void }) {
  return (
    <button className="chip" onClick={() => onFoco(p.id)} title={`Ir a ${nombreCompleto(p)}`}>
      {fotoPrincipal(p) ? (
        <Retrato persona={p} clase="mini" />
      ) : (
        <span className="mini">{iniciales(p)}</span>
      )}
      {nombreCompleto(p)}
    </button>
  );
}

export default function FichaPersona({
  persona: p,
  personas,
  onFoco,
  onEditar,
  onAgregar,
  puedeBorrar,
  onBorrar,
}: Props) {
  const ix = indexar(personas);
  const años = edad(p);
  const linaje = useMemo(() => linajeDe(p.id, personas), [p.id, personas]);

  const contacto: [string, string | undefined][] = [
    ["Celular", p.celular],
    ["Correo", p.email],
    ["Dirección", p.direccion],
  ];
  const hayContacto = contacto.some(([, v]) => v);

  return (
    <aside className="panel">
      <div className="panel-cuerpo">
        <div className="ficha-cabecera">
          <Visor persona={p} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 22 }}>{nombreCompleto(p)}</h2>
            {p.apodo && (
              <div style={{ color: "var(--tinta-tenue)", fontSize: 13.5 }}>«{p.apodo}»</div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span className={`pastilla ${p.vivo ? "viva" : "difunta"}`}>
                {p.vivo ? "Vive" : "Falleció"}
              </span>
              {años !== null && (
                <span className="pastilla">
                  {años} años{p.vivo ? "" : " al fallecer"}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="datos">
          {p.fechaNacimiento && (
            <>
              <dt>Nació</dt>
              <dd>{formatearFecha(p.fechaNacimiento)}</dd>
            </>
          )}
          {p.lugarNacimiento && (
            <>
              <dt>en</dt>
              <dd>{p.lugarNacimiento}</dd>
            </>
          )}
          {p.fechaFallecimiento && (
            <>
              <dt>Falleció</dt>
              <dd>{formatearFecha(p.fechaFallecimiento)}</dd>
            </>
          )}
          {p.apellidoNacimiento && (
            <>
              <dt>Ap. de nacimiento</dt>
              <dd>{p.apellidoNacimiento}</dd>
            </>
          )}
        </dl>

        {hayContacto && (
          <dl className="datos">
            {contacto.map(([etiqueta, valor]) =>
              valor ? (
                <div key={etiqueta} style={{ display: "contents" }}>
                  <dt>{etiqueta}</dt>
                  <dd>
                    {etiqueta === "Correo" ? (
                      <a href={`mailto:${valor}`}>{valor}</a>
                    ) : etiqueta === "Celular" ? (
                      <a href={`tel:${valor.replace(/[^+\d]/g, "")}`}>{valor}</a>
                    ) : (
                      valor
                    )}
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
        )}

        {p.notas && (
          <p className="prosa" style={{ fontSize: 13.5, color: "var(--tinta-suave)" }}>
            {p.notas}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button className="btn primario" onClick={onEditar}>
            Editar
          </button>
          {puedeBorrar && (
            <button className="btn peligro chico" onClick={onBorrar}>
              Eliminar
            </button>
          )}
        </div>

        <div className="seccion-form">
          <h3>Sumar familia</h3>
          <p>Crea la persona y deja el vínculo hecho de los dos lados.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn chico" onClick={() => onAgregar("padre")}>
              + Padre / madre
            </button>
            <button className="btn chico" onClick={() => onAgregar("pareja")}>
              + Pareja
            </button>
            <button className="btn chico" onClick={() => onAgregar("hijo")}>
              + Hijo / hija
            </button>
            <button className="btn chico" onClick={() => onAgregar("hermano")}>
              + Hermano / hermana
            </button>
          </div>
        </div>

        {/* Linaje completo: cada persona del árbol con el nombre del vínculo,
            de lo más cercano a lo más lejano. Reemplaza a los grupos fijos
            (padres, abuelos, tíos…) porque el árbol crece y siempre aparece
            alguien que no entraba en ninguna de esas cajas. */}
        {linaje.map((g) => (
          <div className="grupo-rel" key={g.clave}>
            <h4>
              {g.titulo} ({g.gente.length})
            </h4>
            <div className="chips">
              {g.gente.map((otro) => (
                <Chip key={otro.id} p={otro} onFoco={onFoco} />
              ))}
            </div>
          </div>
        ))}

        {linaje.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--tinta-tenue)", marginTop: 18 }}>
            Todavía no está vinculada con nadie. Sumá un padre, una madre, una pareja o un
            hijo desde los botones de arriba.
          </p>
        )}

        <p style={{ fontSize: 11.5, color: "var(--tinta-tenue)", marginTop: 24 }}>
          {p.creadoPor ? `Cargada por ${p.creadoPor}. ` : ""}
          Última edición {new Date(p.actualizadoEn).toLocaleDateString("es-AR")}
          {p.actualizadoPor ? ` por ${p.actualizadoPor}` : ""}.
        </p>
      </div>
    </aside>
  );
}
