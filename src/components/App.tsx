"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Acceso from "@/components/Acceso";
import Ajustes from "@/components/Ajustes";
import ArbolVista from "@/components/ArbolVista";
import Aviso from "@/components/Aviso";
import BuscadorPersonas from "@/components/BuscadorPersonas";
import FichaPersona, { type TipoVinculo } from "@/components/FichaPersona";
import FormularioPersona from "@/components/FormularioPersona";
import ListaPersonas from "@/components/ListaPersonas";
import Revision from "@/components/Revision";
import {
  borrarPersona,
  crearPersona,
  editarPersona,
  guardarAutor,
  guardarFoco,
  leerAutor,
  leerFocoGuardado,
  deshacerCambio,
  sembrar,
  traerArbol,
  cerrarSesion,
  guardarClaveAdmin,
  leerClaveAdmin,
  type EstadoAlmacenamiento,
  type Permisos,
  type Sesion,
} from "@/lib/cliente";
import {
  hijosDe,
  indexar,
  nombreCompleto,
  nombreCorto,
  ordenarPorNacimiento,
  padresDe,
  parejasDe,
} from "@/lib/tree";
import { revisar } from "@/lib/revision";
import type { Persona, PersonaEntrada } from "@/lib/types";

type Vista = "arbol" | "personas" | "revision" | "ajustes";

/** Estado del formulario: cerrado, editando a alguien, o creando (con vínculo o sin él). */
type Edicion =
  | null
  | { modo: "editar"; persona: Persona }
  | { modo: "crear"; vinculo?: { tipo: TipoVinculo; base: Persona } };

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [esEjemplo, setEsEjemplo] = useState(false);
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamiento | null>(null);
  const [permisos, setPermisos] = useState<Permisos>({
    puedeVer: true,
    puedeEditar: true,
    puedeBorrar: false,
    restringido: false,
  });
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [contacto, setContacto] = useState({ email: "ariel@baudry.com.ar", telefono: "" });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("arbol");
  const [focoId, setFocoId] = useState<string | null>(null);
  /** Personas por las que se pasó, para poder volver sobre los pasos. */
  const [historial, setHistorial] = useState<string[]>([]);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [autor, setAutor] = useState("");

  // Tema guardado, antes de que se vea nada.
  useEffect(() => {
    const t = window.localStorage.getItem("hdll:tema");
    if (t === "claro" || t === "oscuro") document.documentElement.setAttribute("data-tema", t);
    setAutor(leerAutor());
  }, []);

  const aplicar = useCallback((lista: Persona[]) => {
    setPersonas(lista);
    setFocoId((actual) => {
      if (actual && lista.some((p) => p.id === actual)) return actual;
      return ordenarPorNacimiento(lista).at(-1)?.id ?? null;
    });
  }, []);

  useEffect(() => {
    traerArbol()
      .then((datos) => {
        setPersonas(datos.personas);
        setEsEjemplo(datos.esEjemplo);
        setAlmacenamiento(datos.almacenamiento);
        setPermisos(datos.permisos);
        setSesion(datos.sesion ?? null);
        if (datos.contacto) setContacto(datos.contacto);

        const guardado = leerFocoGuardado();
        const valido = guardado && datos.personas.some((p) => p.id === guardado);
        // Sin foco previo, arranca en la persona más joven: el árbol se lee hacia atrás.
        setFocoId(valido ? guardado : (ordenarPorNacimiento(datos.personas).at(-1)?.id ?? null));
      })
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar el árbol."))
      .finally(() => setCargando(false));
  }, []);

  const foco = useMemo(() => personas.find((p) => p.id === focoId) ?? null, [personas, focoId]);

  /**
   * Al globo de la pestaña sólo van los hallazgos que piden una decisión —
   * errores duros y dudas concretas—. Lo que falta completar (fechas, puntas
   * abiertas del árbol) no se cuenta: si avisa de todo, no avisa de nada.
   */
  const pendientes = useMemo(
    () => revisar(personas).filter((h) => h.gravedad !== "sugerencia").length,
    [personas],
  );

  /**
   * Único camino para cambiar de persona. Apila el foco anterior para que el
   * botón «atrás» pueda deshacer el recorrido: explorando un árbol es normal
   * meterse por una rama y querer volver a donde se estaba.
   */
  const irA = useCallback(
    (id: string, opciones: { verArbol?: boolean } = {}) => {
      const { verArbol = true } = opciones;
      setFocoId((anterior) => {
        if (anterior && anterior !== id) setHistorial((h) => [...h.slice(-30), anterior]);
        return id;
      });
      guardarFoco(id);
      if (verArbol) setVista("arbol");
    },
    [],
  );

  const atras = useCallback(() => {
    setHistorial((h) => {
      const previo = h.at(-1);
      if (previo) {
        setFocoId(previo);
        guardarFoco(previo);
      }
      return h.slice(0, -1);
    });
  }, []);

  /** Datos que ya vienen puestos según de dónde salió el "+". */
  function inicialSegunVinculo(v: { tipo: TipoVinculo; base: Persona }): Partial<PersonaEntrada> {
    const ix = indexar(personas);
    switch (v.tipo) {
      case "hijo": {
        const pareja = parejasDe(v.base.id, ix);
        return {
          apellidos: v.base.apellidos,
          padres: [v.base.id, ...(pareja.length === 1 ? [pareja[0].id] : [])],
        };
      }
      case "hermano":
        // Si la base no tiene padres cargados, `guardar()` crea la ficha que
        // hace falta para que la hermandad se pueda deducir.
        return { apellidos: v.base.apellidos, padres: [...v.base.padres] };
      case "pareja":
        return { parejas: [{ personaId: v.base.id, tipo: "pareja" }] };
      case "padre":
        // El vínculo no va en la persona nueva sino en la base: se aplica al guardar.
        return { apellidos: v.base.apellidos, vivo: false };
    }
  }

  async function guardar(datos: PersonaEntrada) {
    setGuardando(true);
    setErrorForm(null);
    try {
      if (edicion?.modo === "editar") {
        const res = await editarPersona(edicion.persona.id, datos, autor);
        aplicar(res.personas);
      } else if (edicion?.modo === "crear") {
        const v = edicion.vinculo;

        // Hermanos sin padres cargados: la hermandad se deduce de tener un
        // padre o madre en común, así que si no hay ninguno hace falta crear la
        // ficha de esa persona aunque no se sepa su nombre. Queda como punta
        // abierta del árbol, que es exactamente lo que es.
        let padresCompartidos = v?.tipo === "hermano" ? [...v.base.padres] : [];
        if (v?.tipo === "hermano" && padresCompartidos.length === 0) {
          const marcador = await crearPersona(
            {
              nombres: "Padre o madre",
              apellidos: v.base.apellidos,
              vivo: false,
              fotos: [],
              padres: [],
              parejas: [],
              notas: `Ficha creada para poder vincular como hermanos a ${nombreCompleto(v.base)} y quien se cargue ahora. Completá el nombre cuando lo sepan.`,
            },
            autor,
          );
          padresCompartidos = [marcador.persona.id];
          await editarPersona(v.base.id, { padres: padresCompartidos }, autor);
        }

        const res = await crearPersona(
          v?.tipo === "hermano" ? { ...datos, padres: padresCompartidos } : datos,
          autor,
        );
        let lista = res.personas;

        // "Agregar padre/madre": el vínculo se guarda en la persona de origen.
        if (v?.tipo === "padre") {
          const base = lista.find((p) => p.id === v.base.id);
          const padres = [...new Set([...(base?.padres ?? []), res.persona.id])].slice(0, 2);
          lista = (await editarPersona(v.base.id, { padres }, autor)).personas;
        }

        aplicar(lista);
        irA(res.persona.id, { verArbol: false });
      }
      setEsEjemplo(false);
      setEdicion(null);
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(p: Persona) {
    if (!window.confirm(`¿Eliminar a ${nombreCompleto(p)} y todos sus vínculos?`)) return;
    try {
      aplicar((await borrarPersona(p.id, autor)).personas);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  }

  async function deshacer() {
    try {
      aplicar((await deshacerCambio(autor)).personas);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "No se pudo deshacer.");
    }
  }

  /** Reintenta la carga con otra clave, para ver si habilita el borrado. */
  async function probarClave(clave: string) {
    guardarClaveAdmin(clave);
    try {
      const datos = await traerArbol();
      setPermisos(datos.permisos);
      aplicar(datos.personas);
      return datos.permisos.puedeBorrar;
    } catch {
      return false;
    }
  }

  async function reiniciar(accion: "ejemplo" | "vaciar") {
    const res = await sembrar(accion, autor);
    setEsEjemplo(res.esEjemplo);
    setFocoId(null);
    setHistorial([]);
    aplicar(res.personas);
  }

  async function importar(lista: unknown[]) {
    const res = await fetch("/api/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personas: lista, autor }),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(datos.error ?? "No se pudo importar.");
      return;
    }
    setEsEjemplo(false);
    setFocoId(null);
    aplicar(datos.personas);
  }

  const tituloForm =
    edicion?.modo === "editar"
      ? `Editar a ${nombreCompleto(edicion.persona)}`
      : edicion?.vinculo
        ? {
            padre: `Padre o madre de ${nombreCompleto(edicion.vinculo.base)}`,
            hijo: `Hijo o hija de ${nombreCompleto(edicion.vinculo.base)}`,
            pareja: `Pareja de ${nombreCompleto(edicion.vinculo.base)}`,
            hermano: `Hermano o hermana de ${nombreCompleto(edicion.vinculo.base)}`,
          }[edicion.vinculo.tipo]
        : "Agregar persona";

  // Sin permiso de lectura no se dibuja nada del árbol: sólo la puerta.
  if (!cargando && !permisos.puedeVer) {
    return (
      <Acceso
        contacto={contacto}
        vencido={typeof window !== "undefined" && window.location.search.includes("acceso=vencido")}
      />
    );
  }

  return (
    <div className="app">
      <Aviso restringido={permisos.restringido} />

      <header className="cabecera">
        <div className="marca">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26">
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
          <span className="titulo">
            <h1>Hasta dónde llegaré</h1>
            <span className="sub">el árbol de la familia, cargado entre todos</span>
          </span>
        </div>

        {personas.length > 0 && <BuscadorPersonas personas={personas} onElegir={(id) => irA(id)} />}

        <nav className="pestanas" role="tablist" aria-label="Secciones">
          {(
            [
              ["arbol", "Árbol"],
              ["personas", "Personas"],
              ["revision", "Revisión"],
              ["ajustes", "Ajustes"],
            ] as [Vista, string][]
          ).map(([v, etiqueta]) => (
            <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)}>
              {etiqueta}
              {v === "revision" && pendientes > 0 && (
                <span className="globo" title={`${pendientes} cosas para revisar`}>{pendientes}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="btn primario" onClick={() => setEdicion({ modo: "crear" })}>
          <span aria-hidden="true">+</span> Agregar persona
        </button>
      </header>

      {almacenamiento?.advertencia && (
        <div className="aviso rojo">
          <span aria-hidden="true">⚠️</span>
          <p style={{ margin: 0 }}>
            <strong>Nada de lo que cargues se va a guardar.</strong> {almacenamiento.advertencia}
          </p>
        </div>
      )}

      {esEjemplo && (
        <div className="aviso rojo">
          <span aria-hidden="true">🧪</span>
          <p style={{ margin: 0 }}>
            Estás viendo la <strong>familia de ejemplo</strong> — personas inventadas.
            <span className="aviso-detalle">
              {" "}
              Cuando cargues a alguien real este cartel se va solo; para borrar todo de una,
              andá a Ajustes → «Vaciar y empezar de cero».
            </span>
          </p>
        </div>
      )}

      {cargando ? (
        <div className="vacio">Cargando el árbol…</div>
      ) : errorCarga ? (
        <div className="vacio">
          <h2>No se pudo cargar el árbol</h2>
          <p className="prosa" style={{ maxWidth: 520, margin: "0 auto" }}>{errorCarga}</p>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      ) : personas.length === 0 ? (
        <div className="vacio">
          <h2>El árbol está vacío</h2>
          <p className="prosa" style={{ maxWidth: 460, margin: "0 auto 18px" }}>
            Empezá por vos: cargate y después sumá a tus padres. Cada persona nueva se engancha
            desde la ficha de otra, así los vínculos quedan bien de los dos lados.
          </p>
          <button className="btn primario" onClick={() => setEdicion({ modo: "crear" })}>
            Cargar la primera persona
          </button>
        </div>
      ) : vista === "arbol" ? (
        <>
          {foco && (
            <div className="barra-contexto">
              <button
                className="btn chico fantasma"
                onClick={atras}
                disabled={historial.length === 0}
                title="Volver a la persona anterior"
              >
                ← Atrás
              </button>

              <span className="ruta">
                Árbol de <strong>{nombreCompleto(foco)}</strong>
              </span>

              <div className="saltos">
                {padresDe(foco.id, indexar(personas)).map((p) => (
                  <button key={p.id} className="salto" onClick={() => irA(p.id)}>
                    ↑ {nombreCorto(p)}
                  </button>
                ))}
                {hijosDe(foco.id, personas).slice(0, 3).map((h) => (
                  <button key={h.id} className="salto" onClick={() => irA(h.id)}>
                    ↓ {nombreCorto(h)}
                  </button>
                ))}
              </div>

              {!panelAbierto && (
                <button className="btn chico" onClick={() => setPanelAbierto(true)}>
                  Ver ficha
                </button>
              )}
              <button
                className="btn chico"
                onClick={() => setEdicion({ modo: "editar", persona: foco })}
              >
                Editar ficha
              </button>
            </div>
          )}

          <div className="contenido">
            {focoId && (
              <ArbolVista
                personas={personas}
                focoId={focoId}
                onFoco={(id) => {
                  setPanelAbierto(true);
                  irA(id, { verArbol: false });
                }}
                onEditar={(id) => {
                  const p = personas.find((x) => x.id === id);
                  if (p) setEdicion({ modo: "editar", persona: p });
                }}
              />
            )}
            {foco && panelAbierto && (
              <FichaPersona
                persona={foco}
                personas={personas}
                onFoco={(id) => irA(id, { verArbol: false })}
                onCerrar={() => setPanelAbierto(false)}
                onEditar={() => setEdicion({ modo: "editar", persona: foco })}
                onAgregar={(tipo) => setEdicion({ modo: "crear", vinculo: { tipo, base: foco } })}
                puedeBorrar={permisos.puedeBorrar}
                onBorrar={() => void borrar(foco)}
              />
            )}
          </div>
        </>
      ) : vista === "revision" ? (
        <Revision
          personas={personas}
          onFoco={(id) => irA(id)}
        />
      ) : vista === "personas" ? (
        <ListaPersonas
          personas={personas}
          onFoco={(id) => irA(id)}
          onEditar={(p) => setEdicion({ modo: "editar", persona: p })}
          onNueva={() => setEdicion({ modo: "crear" })}
        />
      ) : (
        <Ajustes
          personas={personas}
          esEjemplo={esEjemplo}
          almacenamiento={almacenamiento}
          permisos={permisos}
          sesion={sesion}
          onSalir={async () => {
            await cerrarSesion();
            window.location.href = "/";
          }}
          onProbarClave={probarClave}
          autor={autor}
          onAutor={(n) => {
            setAutor(n);
            guardarAutor(n);
          }}
          onDeshacer={() => void deshacer()}
          onSembrar={(a) => void reiniciar(a)}
          onImportar={(l) => void importar(l)}
        />
      )}

      {edicion && (
        <FormularioPersona
          persona={edicion.modo === "editar" ? edicion.persona : null}
          personas={personas}
          titulo={tituloForm}
          inicial={
            edicion.modo === "crear" && edicion.vinculo
              ? inicialSegunVinculo(edicion.vinculo)
              : undefined
          }
          nota={
            edicion.modo === "crear" &&
            edicion.vinculo?.tipo === "hermano" &&
            edicion.vinculo.base.padres.length === 0
              ? `Ser hermanos quiere decir compartir padre o madre. Como todavía no hay ninguno cargado para ${nombreCompleto(edicion.vinculo.base)}, se va a crear una ficha «Padre o madre ${edicion.vinculo.base.apellidos}» para vincularlos; después se completa con el nombre cuando lo sepan.`
              : undefined
          }
          guardando={guardando}
          error={errorForm}
          onGuardar={(datos) => void guardar(datos)}
          onCancelar={() => {
            setEdicion(null);
            setErrorForm(null);
          }}
        />
      )}
    </div>
  );
}
