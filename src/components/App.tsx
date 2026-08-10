"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Acceso from "@/components/Acceso";
import Ajustes from "@/components/Ajustes";
import ArbolVista from "@/components/ArbolVista";
import Aviso from "@/components/Aviso";
import Bienvenida, { type AltaPropia } from "@/components/Bienvenida";
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
  leerMiFicha,
  guardarMiFicha,
  deshacerCambio,
  sembrar,
  traerArbol,
  cerrarSesion,
  ConflictoDeEdicion,
  latir,
  guardarClaveAdmin,
  leerClaveAdmin,
  type EstadoAlmacenamiento,
  type Permisos,
  type Movimiento,
  type Sesion,
} from "@/lib/cliente";
import {
  esAscendente,
  hijosDe,
  indexar,
  nombreCompleto,
  nombreCorto,
  ordenarPorNacimiento,
  padresDe,
  parejasDe,
} from "@/lib/tree";
import { buscarPersona, esInequivoca } from "@/lib/coincidencias";
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
  const [espejo, setEspejo] = useState<{ principal: string } | null>(null);
  const [bitacora, setBitacora] = useState<Movimiento[]>([]);
  /** La ficha de quien está usando este navegador; a ella vuelve la marca. */
  const [miFicha, setMiFicha] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("arbol");
  const [focoId, setFocoId] = useState<string | null>(null);
  /** Personas por las que se pasó, para poder volver sobre los pasos. */
  const [historial, setHistorial] = useState<string[]>([]);
  /**
   * En el celular la ficha es una hoja que tapa el árbol, así que arranca
   * cerrada: primero se ve el árbol, y la ficha sube al tocar a alguien.
   */
  const [panelAbierto, setPanelAbierto] = useState(true);
  /** Menú del celular: en pantalla chica no entran las pestañas ni el alta. */
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [versionAlDia, setVersionAlDia] = useState<string | undefined>();
  const [autor, setAutor] = useState("");
  const [conectados, setConectados] = useState<string[]>([]);
  const [rev, setRev] = useState<number | null>(null);
  const [verConectados, setVerConectados] = useState(false);

  // Tema guardado, antes de que se vea nada.
  useEffect(() => {
    if (window.innerWidth <= 900) setPanelAbierto(false);
    // Claro por defecto: el árbol se lee mejor y es lo que espera la familia.
    // Quien prefiera oscuro lo elige en Ajustes y queda guardado.
    const t = window.localStorage.getItem("hdll:tema") ?? "claro";
    if (t === "claro" || t === "oscuro") document.documentElement.setAttribute("data-tema", t);
    setAutor(leerAutor());
    setMiFicha(leerMiFicha());
  }, []);

  const edicionRef = useRef<Edicion>(null);
  useEffect(() => {
    edicionRef.current = edicion;
  }, [edicion]);

  const aplicar = useCallback((lista: Persona[]) => {
    setPersonas(lista);
    setFocoId((actual) => {
      if (actual && lista.some((p) => p.id === actual)) return actual;
      return ordenarPorNacimiento(lista).at(0)?.id ?? null;
    });
  }, []);

  useEffect(() => {
    traerArbol()
      .then((datos) => {
        setPersonas(datos.personas);
        setEsEjemplo(datos.esEjemplo);
        setAlmacenamiento(datos.almacenamiento);
        setPermisos(datos.permisos);
        setRev(datos.rev ?? null);
        setSesion(datos.sesion ?? null);
        if (datos.contacto) setContacto(datos.contacto);
        setEspejo(datos.espejo ?? null);
        setBitacora(datos.bitacora ?? []);

        const guardado = leerFocoGuardado();
        const valido = guardado && datos.personas.some((p) => p.id === guardado);
        // Sin foco previo, arranca en la persona más antigua: es la raíz del
        // árbol y desde ahí se lee todo hacia abajo.
        setFocoId(valido ? guardado : (ordenarPorNacimiento(datos.personas).at(0)?.id ?? null));
      })
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar el árbol."))
      .finally(() => setCargando(false));
  }, []);

  /**
   * Late cada tanto para que el resto sepa que estamos, y de paso se entera de
   * si alguien guardó algo: si el `rev` del servidor cambió, se recarga el
   * árbol. Nunca mientras haya un formulario abierto, para no pisar lo que se
   * está escribiendo.
   */
  useEffect(() => {
    if (!autor || !permisos.puedeVer || espejo) return;
    let vivo = true;

    const tic = async () => {
      try {
        const r = await latir(autor);
        if (!vivo) return;
        setConectados(r.conectados);
        setRev((actual) => {
          if (actual !== null && r.rev !== actual && !edicionRef.current) {
            traerArbol()
              .then((d) => {
                setPersonas(d.personas);
                setEsEjemplo(d.esEjemplo);
                setBitacora(d.bitacora ?? []);
              })
              .catch(() => {});
          }
          return r.rev;
        });
      } catch {
        /* si falla un latido no pasa nada: se reintenta al siguiente */
      }
    };

    void tic();
    const id = window.setInterval(tic, 25_000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [autor, permisos.puedeVer, espejo]);

  /**
   * Para quien ya venía usando el sitio antes de que se recordara la ficha
   * propia: se deduce del nombre declarado, y sólo si no hay dudas.
   */
  const deducirMiFicha = useCallback(() => {
    if (!autor) return null;
    const c = buscarPersona(autor, personas);
    if (!esInequivoca(c)) return null;
    guardarMiFicha(c[0].persona.id);
    setMiFicha(c[0].persona.id);
    return c[0].persona.id;
  }, [autor, personas]);

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

  /**
   * "+ Padre", "+ Pareja"… desde el modal de edición: primero se guarda lo que
   * se venía editando y recién después se abre la ficha del pariente nuevo.
   */
  async function guardarYSumar(tipo: TipoVinculo, datos: PersonaEntrada) {
    if (edicion?.modo !== "editar") return;
    const base = edicion.persona;
    const ok = await guardar(datos, { cerrar: false });
    if (!ok) return;
    const alDia = personas.find((p) => p.id === base.id) ?? base;
    setEdicion({ modo: "crear", vinculo: { tipo, base: alDia } });
  }

  /**
   * Qué padres van a compartir esta ficha y los hermanos que se eligieron.
   * Manda lo que ya tenga cargado la ficha; si no tiene, se adoptan los del
   * primer hermano que sí. Si ninguno tiene, hace falta crear la ficha del
   * padre o la madre aunque no se sepa el nombre: sin nadie en común no hay
   * manera de deducir la hermandad. Queda como punta abierta del árbol.
   */
  async function padresParaHermanar(
    elegidos: string[],
    datos: PersonaEntrada,
    propios: string[],
  ): Promise<string[]> {
    if (propios.length) return propios;

    for (const id of elegidos) {
      const h = personas.find((p) => p.id === id);
      if (h?.padres.length) return [...h.padres];
    }

    const primero = personas.find((p) => p.id === elegidos[0]);
    const quienes = [primero ? nombreCompleto(primero) : "esa persona", `${datos.nombres} ${datos.apellidos}`];
    const marcador = await crearPersona(
      {
        nombres: "Padre o madre",
        apellidos: primero?.apellidos ?? datos.apellidos,
        vivo: false,
        fotos: [],
        padres: [],
        parejas: [],
        notas: `Ficha creada para vincular como hermanos a ${quienes.join(" y ")}. Completá el nombre cuando lo sepan.`,
      },
      autor,
    );
    return [marcador.persona.id];
  }

  /**
   * Le pasa esos padres a cada hermano elegido que no tenga ninguno. A los que
   * ya tienen otros cargados no se los toca: pisarlos borraría el trabajo de
   * quien los cargó, y acá nadie borra datos de otro.
   */
  async function propagarHermanos(
    elegidos: string[],
    padres: string[],
    lista: Persona[],
  ): Promise<Persona[]> {
    if (!elegidos.length || !padres.length) return lista;
    let actual = lista;
    for (const id of elegidos) {
      const h = actual.find((p) => p.id === id);
      if (!h || h.padres.length) continue;
      actual = (await editarPersona(id, { padres }, autor)).personas;
    }
    return actual;
  }

  /**
   * Los hijos que se sumaron y los que se sacaron. `padreId` es null en un alta:
   * la persona todavía no existe.
   */
  function cambioDeHijos(padreId: string | null, deseados: string[], lista: Persona[]) {
    const quiero = [...new Set(deseados.filter(Boolean))];
    const tiene = padreId ? hijosDe(padreId, lista).map((p) => p.id) : [];
    return {
      sumar: quiero.filter((id) => !tiene.includes(id)),
      sacar: tiene.filter((id) => !quiero.includes(id)),
    };
  }

  /**
   * Se revisa **antes de escribir nada**. Si un caso no da, tiene que no entrar
   * ninguno: guardar la mitad dejaría la ficha en pantalla desactualizada y el
   * siguiente intento chocaría contra su propia versión vieja.
   */
  function revisarHijos(padreId: string | null, deseados: string[], lista: Persona[]): void {
    const { sumar } = cambioDeHijos(padreId, deseados, lista);
    const ix = indexar(lista);
    for (const id of sumar) {
      const h = lista.find((p) => p.id === id);
      if (!h) continue;
      if (h.padres.length >= 2) {
        throw new Error(
          `${nombreCompleto(h)} ya tiene cargados padre y madre. Quitá uno en su ficha antes de sumarla acá.`,
        );
      }
      if (padreId && esAscendente(id, padreId, ix)) {
        throw new Error(
          `${nombreCompleto(h)} es ascendente de esta persona: no puede ser también su hijo/a.`,
        );
      }
    }
  }

  /**
   * Deja los hijos de alguien exactamente como quedaron en el formulario. El
   * vínculo no vive acá sino en el campo `padres` de cada hijo, así que se
   * agrega o se saca de cada uno de ellos.
   */
  async function aplicarHijos(
    padreId: string,
    deseados: string[],
    lista: Persona[],
  ): Promise<Persona[]> {
    const { sumar, sacar } = cambioDeHijos(padreId, deseados, lista);
    if (!sumar.length && !sacar.length) return lista;

    let actual = lista;
    for (const id of sumar) {
      const h = actual.find((p) => p.id === id);
      if (!h) continue;
      actual = (await editarPersona(id, { padres: [...h.padres, padreId] }, autor)).personas;
    }
    for (const id of sacar) {
      const h = actual.find((p) => p.id === id);
      if (!h) continue;
      actual = (await editarPersona(id, { padres: h.padres.filter((x) => x !== padreId) }, autor)).personas;
    }
    return actual;
  }

  async function guardar(entrada: PersonaEntrada, opciones: { cerrar?: boolean } = {}) {
    setGuardando(true);
    setErrorForm(null);
    setVersionAlDia(undefined);
    try {
      // Hermanos e hijos no son campos de esta ficha: son instrucciones del
      // formulario. Se traducen antes de guardar —los hermanos, a compartir
      // padres— y después —los hijos, al campo `padres` de cada hijo—.
      const { hermanosDe, hijos, ...datos } = entrada;
      const elegidos = (hermanosDe ?? []).filter(Boolean);
      if (hijos) {
        revisarHijos(edicion?.modo === "editar" ? edicion.persona.id : null, hijos, personas);
      }
      if (elegidos.length) {
        datos.padres = await padresParaHermanar(elegidos, datos, [...(datos.padres ?? [])]);
      }
      if (edicion?.modo === "editar") {
        const yo = edicion.persona.id;
        const res = await editarPersona(yo, datos, autor);
        let lista = res.personas;
        lista = await propagarHermanos(elegidos, datos.padres ?? [], lista);
        if (hijos) lista = await aplicarHijos(yo, hijos, lista);
        aplicar(lista);
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

        lista = await propagarHermanos(elegidos, datos.padres ?? [], lista);
        if (hijos) lista = await aplicarHijos(res.persona.id, hijos, lista);

        aplicar(lista);
        irA(res.persona.id, { verArbol: false });
      }
      setEsEjemplo(false);
      if (opciones.cerrar !== false) setEdicion(null);
      return true;
    } catch (e) {
      if (e instanceof ConflictoDeEdicion) {
        // Se recarga el árbol para que se vea lo que puso el otro, se adopta la
        // versión nueva —para que el segundo intento sí entre— y se avisa sin
        // cerrar el formulario: lo escrito no se pierde.
        traerArbol().then((d) => setPersonas(d.personas)).catch(() => {});
        setVersionAlDia(e.persona.actualizadoEn);
        setErrorForm(
          `${e.message} Fijate cómo quedó en el árbol; si tu versión sigue siendo la correcta, guardá de nuevo y esta vez entra.`,
        );
      } else {
        setErrorForm(e instanceof Error ? e.message : "No se pudo guardar.");
        // Puede haber fallado a mitad de camino —la ficha guardada y el vínculo
        // con un pariente no—. Se recarga el árbol y se adopta la versión al
        // día para que el segundo intento no choque contra la propia.
        if (edicion?.modo === "editar") {
          const yo = edicion.persona.id;
          traerArbol()
            .then((d) => {
              setPersonas(d.personas);
              const alDia = d.personas.find((p) => p.id === yo);
              if (alDia) setVersionAlDia(alDia.actualizadoEn);
            })
            .catch(() => {});
        }
      }
      return false;
    } finally {
      setGuardando(false);
    }
  }

  /**
   * Alta de quien entra y todavía no está en el árbol. Los vínculos de dos
   * saltos —nieto, sobrino— necesitan una persona en el medio; se crea como
   * ficha sin nombre, igual que al sumar un hermano sin padres cargados, y
   * queda como una punta abierta más para completar.
   */
  async function crearMiFicha({ nombres, apellidos, enganche }: AltaPropia) {
    const base = personas.find((p) => p.id === enganche.personaId);
    if (!base) throw new Error("No encontré a esa persona.");

    const marcador = async (apellido: string, padres: string[], nota: string) =>
      (
        await crearPersona(
          { nombres: "Padre o madre", apellidos: apellido, vivo: false, fotos: [], padres, parejas: [], notas: nota },
          nombres,
        )
      ).persona;

    let padres: string[] = [];
    let parejas: { personaId: string; tipo: "pareja" }[] = [];
    let engancharDespues: string | null = null;

    switch (enganche.tipo) {
      case "hijo": {
        const pareja = parejasDe(base.id, indexar(personas));
        padres = [base.id, ...(pareja.length === 1 ? [pareja[0].id] : [])];
        break;
      }
      case "padre":
        engancharDespues = base.id;
        break;
      case "pareja":
        parejas = [{ personaId: base.id, tipo: "pareja" }];
        break;
      case "hermano": {
        if (base.padres.length) padres = [...base.padres];
        else {
          const m = await marcador(
            base.apellidos,
            [],
            `Ficha creada para vincular como hermanos a ${nombreCompleto(base)} y ${nombres} ${apellidos}.`,
          );
          await editarPersona(base.id, { padres: [m.id] }, nombres);
          padres = [m.id];
        }
        break;
      }
      case "nieto": {
        const m = await marcador(
          base.apellidos,
          [base.id],
          `Ficha creada para vincular a ${nombres} ${apellidos} como nieto/a de ${nombreCompleto(base)}. Falta el nombre.`,
        );
        padres = [m.id];
        break;
      }
      case "sobrino": {
        let padresDelTio = base.padres;
        if (!padresDelTio.length) {
          const abuelo = await marcador(
            base.apellidos,
            [],
            `Ficha creada para vincular a ${nombres} ${apellidos} como sobrino/a de ${nombreCompleto(base)}. Falta el nombre.`,
          );
          await editarPersona(base.id, { padres: [abuelo.id] }, nombres);
          padresDelTio = [abuelo.id];
        }
        const m = await marcador(
          base.apellidos,
          padresDelTio,
          `Hermano/a de ${nombreCompleto(base)}, creado para vincular a ${nombres} ${apellidos}. Falta el nombre.`,
        );
        padres = [m.id];
        break;
      }
    }

    const res = await crearPersona(
      { nombres, apellidos, vivo: true, fotos: [], padres, parejas },
      nombres,
    );

    let lista = res.personas;
    if (engancharDespues) {
      const b = lista.find((p) => p.id === engancharDespues);
      lista = (
        await editarPersona(
          engancharDespues,
          { padres: [...new Set([...(b?.padres ?? []), res.persona.id])].slice(0, 2) },
          nombres,
        )
      ).personas;
    }

    setPersonas(lista);
    setAutor(nombres);
    guardarAutor(nombres);
    setMiFicha(res.persona.id);
    guardarMiFicha(res.persona.id);
    setFocoId(res.persona.id);
    guardarFoco(res.persona.id);
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

  // El nombre se pide una sola vez, antes de dejar tocar nada.
  if (!cargando && !errorCarga && permisos.puedeVer && !autor && !espejo) {
    return (
      <Bienvenida
        personas={personas}
        onListo={(n, id) => {
          setAutor(n);
          guardarAutor(n);
          // El árbol abre en la ficha de quien entra: lo primero que uno quiere
          // ver es dónde está parado en su propia familia.
          if (id) {
            setMiFicha(id);
            guardarMiFicha(id);
            setFocoId(id);
            guardarFoco(id);
          }
        }}
        onAlta={crearMiFicha}
      />
    );
  }

  return (
    <div className="app">
      <Aviso restringido={permisos.restringido} />

      <header className="cabecera">
        <button
          className="marca"
          title="Ir a mi ficha"
          onClick={() => {
            setVista("arbol");
            setMenuAbierto(false);
            setEdicion(null);
            setPanelAbierto(window.innerWidth > 900);
            setHistorial([]);
            const mia = miFicha && personas.some((p) => p.id === miFicha) ? miFicha : null;
            const destino = mia ?? deducirMiFicha() ?? ordenarPorNacimiento(personas).at(0)?.id;
            if (destino) {
              setFocoId(destino);
              guardarFoco(destino);
            }
          }}
        >
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
        </button>

        {personas.length > 0 && <BuscadorPersonas personas={personas} onElegir={(id) => irA(id)} />}

        {conectados.length > 0 && (
          <div className="presencia">
            <button
              className="globo-presencia"
              onClick={() => setVerConectados((v) => !v)}
              aria-expanded={verConectados}
              title={`${conectados.length} mirando el árbol`}
            >
              <span className="punto" aria-hidden="true" />
              {conectados.length}
            </button>
            {verConectados && (
              <div className="lista-presencia">
                <strong>Mirando el árbol ahora</strong>
                <ul>
                  {conectados.map((n) => (
                    <li key={n}>
                      <span className="punto" aria-hidden="true" />
                      {n}
                      {n === autor && " (vos)"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          className="boton-menu"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-expanded={menuAbierto}
          aria-label="Menú"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path
              d={menuAbierto ? "M5 5l10 10M15 5L5 15" : "M3 6h14M3 10h14M3 14h14"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>

        <div className={`acciones${menuAbierto ? " abierto" : ""}`}>
          <nav className="pestanas" role="tablist" aria-label="Secciones">
          {(
            [
              ["arbol", "Árbol"],
              ["personas", "Personas"],
              ["revision", "Revisión"],
              ["ajustes", "Ajustes"],
            ] as [Vista, string][]
          ).map(([v, etiqueta]) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => {
                setVista(v);
                setMenuAbierto(false);
              }}
            >
              {etiqueta}
              {v === "revision" && pendientes > 0 && (
                <span className="globo" title={`${pendientes} cosas para revisar`}>{pendientes}</span>
              )}
            </button>
          ))}
          </nav>

          <button
            className="btn primario"
            onClick={() => {
              setEdicion({ modo: "crear" });
              setMenuAbierto(false);
            }}
          >
            <span aria-hidden="true">+</span> Agregar persona
          </button>
        </div>
      </header>

      {espejo && (
        <div className="aviso rojo">
          <span aria-hidden="true">👁️</span>
          <p style={{ margin: 0 }}>
            <strong>Copia de sólo lectura.</strong> El árbol que vale es el que carga la
            familia:{" "}
            <a href={espejo.principal} target="_blank" rel="noreferrer">
              {espejo.principal.replace(/^https?:\/\//, "")}
            </a>
            . Acá no se puede editar — esta copia se actualiza sola desde allá.
          </p>
        </div>
      )}

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

              <button className="btn chico" onClick={() => setPanelAbierto((v) => !v)}>
                {panelAbierto ? "Ocultar ficha" : "Ver ficha"}
              </button>
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
          bitacora={bitacora}
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
          // Una ficha, un formulario. Sin esto React reusa el mismo y se
          // arrastra lo que había cargado para la persona anterior: pasar de
          // editar a "+ Crear hijo/a" abría el alta con los vínculos del padre.
          key={
            edicion.modo === "editar"
              ? edicion.persona.id
              : `nuevo:${edicion.vinculo?.tipo ?? ""}:${edicion.vinculo?.base.id ?? ""}`
          }
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
          versionAlDia={versionAlDia}
          guardando={guardando}
          error={errorForm}
          onGuardar={(datos) => void guardar(datos)}
          onAgregar={(tipo, datos) => void guardarYSumar(tipo, datos)}
          onCancelar={() => {
            setEdicion(null);
            setErrorForm(null);
            setVersionAlDia(undefined);
          }}
        />
      )}
    </div>
  );
}
