"use client";

import { useEffect, useMemo, useState } from "react";
import CampoFecha from "@/components/CampoFecha";
import FotosInput from "@/components/FotosInput";
import {
  nombreCompleto,
  ordenarPorNacimiento,
  anio,
  hijosDe,
  hermanosDe as hermanosDerivados,
  indexar,
} from "@/lib/tree";
import type { TipoVinculo } from "@/components/FichaPersona";
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
   * Sumar un pariente desde acá. Guarda primero lo que se esté editando —si no,
   * el trabajo a medio hacer se perdería al abrir el otro formulario— y recién
   * después abre la ficha nueva.
   */
  onAgregar?: (tipo: TipoVinculo, datos: PersonaEntrada) => void;
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
  onAgregar,
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
          // Los hijos no son un campo de esta ficha: se deducen de los padres de
          // cada uno. Se traen a la vista para poder elegirlos y quitarlos acá.
          hijos: hijosDe(persona.id, personas).map((p) => p.id),
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
  const hijos = d.hijos ?? [];
  const hermanos = d.hermanosDe ?? [];

  /** Los que ya se deducen de los padres cargados: se muestran, no se piden. */
  const hermanosYa = useMemo(
    () => (persona ? hermanosDerivados(persona.id, personas, indexar(personas)) : []),
    [persona, personas],
  );

  /** Cambia una fila de una lista de ids; vacío la saca. */
  function ponerEnLista(k: "hijos" | "hermanosDe", i: number, id: string) {
    const lista = [...(d[k] ?? [])];
    if (id) lista[i] = id;
    else lista.splice(i, 1);
    campo(k, [...new Set(lista.filter(Boolean))]);
  }

  /** Los dos botones que cierran cada sección de vínculos. */
  function Acciones({ tipo, elegir }: { tipo: TipoVinculo; elegir?: () => void }) {
    const nuevo = {
      padre: "+ Crear padre / madre",
      hijo: "+ Crear hijo / hija",
      hermano: "+ Crear hermano / hermana",
      pareja: "+ Crear pareja",
    }[tipo];
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {elegir && (
          <button type="button" className="btn chico" onClick={elegir}>
            + Elegir de la lista
          </button>
        )}
        {persona && onAgregar && (
          <button
            type="button"
            className="btn chico"
            disabled={guardando}
            title="Crea la ficha nueva y deja el vínculo hecho de los dos lados"
            onClick={() => onAgregar(tipo, d)}
          >
            {nuevo}
          </button>
        )}
      </div>
    );
  }

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
            <h3>Ascendentes · padre y madre</h3>
            <p>
              Elegilos entre los ya cargados, o creá la ficha que falte. Nietos, tíos y primos
              no se cargan: se deducen solos a partir de esto.
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
            <Acciones tipo="padre" />
          </div>

          <div className="seccion-form">
            <h3>Descendentes · hijos e hijas</h3>
            <p>
              El vínculo se guarda en la ficha del hijo, así que elegirlo acá es lo mismo que
              poner a esta persona como padre o madre allá. Vaciar una fila lo desvincula.
            </p>
            <div className="campos">
              {hijos.map((id, i) => (
                <div className="campo" key={`${id}-${i}`}>
                  <label htmlFor={`f-hijo-${i}`}>Hijo / hija {i + 1}</label>
                  <select
                    id={`f-hijo-${i}`}
                    value={id}
                    onChange={(e) => ponerEnLista("hijos", i, e.target.value)}
                  >
                    <option value="">— quitar —</option>
                    {candidatos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiqueta(p)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!hijos.length && <p className="ayuda">Todavía no tiene hijos cargados.</p>}
            <Acciones tipo="hijo" elegir={() => campo("hijos", [...hijos, ""])} />
          </div>

          <div className="seccion-form">
            <h3>Laterales · hermanos y hermanas</h3>
            <p>
              Ser hermanos es compartir padre o madre, así que no se guarda de a uno: al elegir
              a alguien acá, esta ficha y esa persona quedan con los mismos padres. Si ninguna
              los tiene cargados, se crea la ficha que hace falta; si esa persona ya tiene otros,
              se respetan los suyos.
            </p>
            {hermanosYa.length > 0 && (
              <p className="ayuda">
                Ya figuran como hermanos: {hermanosYa.map((p) => nombreCompleto(p)).join(", ")}. Para
                sacar a alguno, corregí los padres.
              </p>
            )}
            <div className="campos">
              {hermanos.map((id, i) => (
                <div className="campo" key={`${id}-${i}`}>
                  <label htmlFor={`f-hermano-${i}`}>Es hermano/a de</label>
                  <select
                    id={`f-hermano-${i}`}
                    value={id}
                    onChange={(e) => ponerEnLista("hermanosDe", i, e.target.value)}
                  >
                    <option value="">— quitar —</option>
                    {candidatos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiqueta(p)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Acciones tipo="hermano" elegir={() => campo("hermanosDe", [...hermanos, ""])} />
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
            {!parejas.length && <p className="ayuda">Todavía no tiene pareja cargada.</p>}
            <Acciones
              tipo="pareja"
              elegir={() =>
                campo("parejas", [...parejas, { personaId: "", tipo: "pareja" as TipoPareja }])
              }
            />
          </div>

          {persona && onAgregar && (
            <p className="ayuda" style={{ marginTop: 14 }}>
              Los botones «Crear…» guardan primero lo que escribiste acá y después abren la ficha
              nueva, con el vínculo ya hecho de los dos lados.
            </p>
          )}

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
