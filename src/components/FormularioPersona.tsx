"use client";

import { useEffect, useMemo, useState } from "react";
import CampoFecha from "@/components/CampoFecha";
import FotosInput from "@/components/FotosInput";
import { nombreCompleto, ordenarPorNacimiento, anio } from "@/lib/tree";
import type { Pareja, Persona, PersonaEntrada, TipoPareja } from "@/lib/types";

interface Props {
  /** null = alta. */
  persona: Persona | null;
  personas: Persona[];
  /** Texto del encabezado cuando se está creando a partir de un vínculo. */
  titulo: string;
  /** Vínculos precargados para el alta. */
  inicial?: Partial<PersonaEntrada>;
  guardando: boolean;
  error: string | null;
  onGuardar: (datos: PersonaEntrada) => void;
  onCancelar: () => void;
  /** Aclaración que depende de cómo se llegó al formulario. */
  nota?: string;
  /**
   * Versión al día de la ficha, cuando el guardado chocó con el de otro. Se
   * adopta sin tocar lo escrito, así el segundo intento sí entra.
   */
  versionAlDia?: string;
}

function vacia(inicial?: Partial<PersonaEntrada>): PersonaEntrada {
  return {
    nombres: "",
    apellidos: "",
    vivo: true,
    fotos: [],
    padres: [],
    parejas: [],
    actualizadoEn: "",
    ...inicial,
  } as PersonaEntrada;
}

export default function FormularioPersona({
  persona,
  personas,
  titulo,
  inicial,
  guardando,
  error,
  onGuardar,
  onCancelar,
  nota,
  versionAlDia,
}: Props) {
  // Los arrays de vínculos se copian aparte: con un spread superficial serían
  // el mismo array que el de la persona guardada, y cualquier retoque acá
  // terminaría tocando el estado de la app.
  const [d, setD] = useState<PersonaEntrada>(() =>
    persona
      ? ({
          ...persona,
          padres: [...persona.padres],
          parejas: persona.parejas.map((v) => ({ ...v })),
          fotos: [...(persona.fotos ?? [])],
        } as PersonaEntrada)
      : vacia(inicial),
  );

  useEffect(() => {
    if (versionAlDia) setD((a) => ({ ...a, actualizadoEn: versionAlDia }));
  }, [versionAlDia]);

  function campo<K extends keyof PersonaEntrada>(k: K, v: PersonaEntrada[K]) {
    setD((actual) => ({ ...actual, [k]: v }));
  }

  /** Candidatos a vínculo: cualquiera menos uno mismo. */
  const candidatos = useMemo(
    () => ordenarPorNacimiento(personas.filter((p) => p.id !== persona?.id)),
    [personas, persona],
  );

  function etiqueta(p: Persona): string {
    const a = anio(p.fechaNacimiento);
    return `${nombreCompleto(p)}${a ? ` (${a})` : ""}`;
  }

  const padres = d.padres ?? [];
  const parejas = d.parejas ?? [];

  function ponerPadre(i: number, id: string) {
    const nuevos = [...padres];
    if (id) nuevos[i] = id;
    else nuevos.splice(i, 1);
    campo("padres", [...new Set(nuevos.filter(Boolean))]);
  }

  function ponerPareja(i: number, cambio: Partial<Pareja>) {
    const nuevas = parejas.map((v, j) => (j === i ? { ...v, ...cambio } : v));
    campo("parejas", nuevas.filter((v) => v.personaId));
  }

  return (
    <div className="telon" onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="btn chico fantasma" onClick={onCancelar}>
            Cerrar
          </button>
        </header>

        <form
          className="cuerpo"
          onSubmit={(e) => {
            e.preventDefault();
            onGuardar(d);
          }}
        >
          {nota && <p className="nota-form">{nota}</p>}

          <div className="campo ancho">
            <label>Fotos</label>
            <FotosInput fotos={d.fotos ?? []} onCambio={(fotos) => campo("fotos", fotos)} />
          </div>

          <div className="campos" style={{ marginTop: 18 }}>
            <div className="campo">
              <label htmlFor="f-nombres">Nombres *</label>
              <input
                id="f-nombres"
                className="campo-texto"
                required
                autoFocus
                value={d.nombres}
                onChange={(e) => campo("nombres", e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="f-apellidos">Apellidos *</label>
              <input
                id="f-apellidos"
                className="campo-texto"
                required
                value={d.apellidos}
                onChange={(e) => campo("apellidos", e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="f-apodo">Apodo</label>
              <input
                id="f-apodo"
                className="campo-texto"
                value={d.apodo ?? ""}
                onChange={(e) => campo("apodo", e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="f-apnac">Apellido de nacimiento</label>
              <input
                id="f-apnac"
                className="campo-texto"
                placeholder="si cambió al casarse"
                value={d.apellidoNacimiento ?? ""}
                onChange={(e) => campo("apellidoNacimiento", e.target.value)}
              />
            </div>

            <div className="campo">
              <label htmlFor="f-nac">Fecha de nacimiento</label>
              <CampoFecha
                id="f-nac"
                valor={d.fechaNacimiento ?? ""}
                onCambio={(v) => campo("fechaNacimiento", v)}
              />
              <span className="ayuda">
                Escribila, o tocá el calendario. Si sólo sabés el año, poné el año y listo.
              </span>
            </div>
            <div className="campo">
              <label htmlFor="f-lugar">Lugar de nacimiento</label>
              <input
                id="f-lugar"
                className="campo-texto"
                placeholder="Ciudad, provincia o país"
                value={d.lugarNacimiento ?? ""}
                onChange={(e) => campo("lugarNacimiento", e.target.value)}
              />
            </div>

            <div className="campo">
              <label htmlFor="f-vivo">¿Vive?</label>
              <select
                id="f-vivo"
                value={d.vivo ? "si" : "no"}
                onChange={(e) => {
                  const vivo = e.target.value === "si";
                  // Al marcarla como viva se borra la fecha: si no, quedaría un
                  // dato contradictorio escondido que el servidor rechazaría.
                  setD((a) => ({ ...a, vivo, fechaFallecimiento: vivo ? undefined : a.fechaFallecimiento }));
                }}
              >
                <option value="si">Sí</option>
                <option value="no">No, falleció</option>
              </select>
            </div>

            {/* El fallecimiento sólo se pregunta cuando corresponde. */}
            {!d.vivo && (
              <div className="campo">
                <label htmlFor="f-fall">Fecha de fallecimiento</label>
                <CampoFecha
                  id="f-fall"
                  valor={d.fechaFallecimiento ?? ""}
                  onCambio={(v) => campo("fechaFallecimiento", v)}
                />
                <span className="ayuda">Opcional: si no la sabés, dejala vacía.</span>
              </div>
            )}
          </div>

          <div className="seccion-form">
            <h3>Contacto</h3>
            <p>Sólo si corresponde. No cargues datos de otra persona sin avisarle.</p>
            <div className="campos">
              <div className="campo">
                <label htmlFor="f-cel">Celular</label>
                <input
                  id="f-cel"
                  className="campo-texto"
                  placeholder="+54 9 11 ..."
                  value={d.celular ?? ""}
                  onChange={(e) => campo("celular", e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="f-mail">Correo electrónico</label>
                <input
                  id="f-mail"
                  className="campo-texto"
                  type="email"
                  value={d.email ?? ""}
                  onChange={(e) => campo("email", e.target.value)}
                />
              </div>
              <div className="campo ancho">
                <label htmlFor="f-dir">Dirección postal</label>
                <input
                  id="f-dir"
                  className="campo-texto"
                  value={d.direccion ?? ""}
                  onChange={(e) => campo("direccion", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="seccion-form">
            <h3>Ascendentes</h3>
            <p>
              Elegí padre y madre entre las personas ya cargadas. Los hijos, hermanos, nietos,
              tíos y primos no se cargan: se deducen solos a partir de esto.
            </p>
            <div className="campos">
              {[0, 1].map((i) => (
                <div className="campo" key={i}>
                  <label htmlFor={`f-padre-${i}`}>{i === 0 ? "Padre / madre 1" : "Padre / madre 2"}</label>
                  <select
                    id={`f-padre-${i}`}
                    value={padres[i] ?? ""}
                    onChange={(e) => ponerPadre(i, e.target.value)}
                  >
                    <option value="">— sin cargar —</option>
                    {candidatos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiqueta(p)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="seccion-form">
            <h3>Laterales · hermanos</h3>
            <p>
              Los hermanos salen de compartir padre o madre, así que no se cargan de a uno:
              se elige a un hermano ya cargado y esta ficha pasa a tener sus mismos padres.
              Si ese hermano tampoco los tiene, se crea la ficha que hace falta.
            </p>
            <div className="campos">
              <div className="campo ancho">
                <label htmlFor="f-hermano">Es hermano/a de</label>
                <select
                  id="f-hermano"
                  value={d.hermanoDe ?? ""}
                  onChange={(e) => campo("hermanoDe", e.target.value || undefined)}
                >
                  <option value="">— no cambiar —</option>
                  {candidatos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {etiqueta(p)}
                    </option>
                  ))}
                </select>
                {d.hermanoDe && (
                  <span className="ayuda">
                    Al guardar, esta ficha va a quedar con los mismos padres que esa persona.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="seccion-form">
            <h3>Laterales · pareja</h3>
            <p>El vínculo se guarda en los dos sentidos automáticamente.</p>
            {parejas.map((v, i) => (
              <div className="campos" key={i} style={{ marginBottom: 10 }}>
                <div className="campo">
                  <label>Persona</label>
                  <select value={v.personaId} onChange={(e) => ponerPareja(i, { personaId: e.target.value })}>
                    <option value="">— quitar —</option>
                    {candidatos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiqueta(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label>Vínculo</label>
                  <select value={v.tipo} onChange={(e) => ponerPareja(i, { tipo: e.target.value as TipoPareja })}>
                    <option value="pareja">En pareja</option>
                    <option value="casado">Casados</option>
                    <option value="separado">Separados</option>
                    <option value="viudo">Viudo/a</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor={`f-pareja-desde-${i}`}>Desde</label>
                  <CampoFecha
                    id={`f-pareja-desde-${i}`}
                    valor={v.desde ?? ""}
                    onCambio={(fecha) => ponerPareja(i, { desde: fecha })}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn chico"
              onClick={() => campo("parejas", [...parejas, { personaId: "", tipo: "pareja" as TipoPareja }])}
            >
              + Agregar pareja
            </button>
          </div>

          <div className="seccion-form">
            <h3>Notas</h3>
            <p>Oficio, anécdotas, de dónde vino la familia, qué falta averiguar.</p>
            <textarea
              rows={4}
              value={d.notas ?? ""}
              onChange={(e) => campo("notas", e.target.value)}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <footer style={{ marginTop: 20, marginInline: -20, marginBottom: -18 }}>
            <button type="button" className="btn" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className="btn primario" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
