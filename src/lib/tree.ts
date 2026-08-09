import type { FechaParcial, Persona } from "./types";

// ---------------------------------------------------------------- utilidades

export type Indice = Map<string, Persona>;

export function indexar(personas: Persona[]): Indice {
  return new Map(personas.map((p) => [p.id, p]));
}

export function nombreCompleto(p: Persona): string {
  return `${p.nombres} ${p.apellidos}`.trim();
}

/** La foto que se usa de retrato: la primera de la lista. */
export function fotoPrincipal(p: Persona): string | undefined {
  return p.fotos?.[0];
}

export function nombreCorto(p: Persona): string {
  const primerNombre = p.nombres.trim().split(/\s+/)[0] ?? "";
  const primerApellido = p.apellidos.trim().split(/\s+/)[0] ?? "";
  return `${primerNombre} ${primerApellido}`.trim() || "Sin nombre";
}

/** "1948", "1948-03" y "1948-03-27" ordenan bien como número. */
export function fechaOrdenable(f?: FechaParcial): number {
  if (!f) return Number.POSITIVE_INFINITY;
  const [a = "0", m = "0", d = "0"] = f.split("-");
  return Number(a) * 10000 + Number(m) * 100 + Number(d);
}

export function anio(f?: FechaParcial): number | null {
  if (!f) return null;
  const a = Number(f.slice(0, 4));
  return Number.isFinite(a) && a > 0 ? a : null;
}

export function formatearFecha(f?: FechaParcial): string {
  if (!f) return "";
  const [a, m, d] = f.split("-");
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  if (d) return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
  if (m) return `${meses[Number(m) - 1]} de ${a}`;
  return a;
}

/**
 * Resumen de fechas para mostrar: "1928 – 2004", "n. 1975", "1946 – ?" o
 * "falleció" cuando no se sabe ninguna. Nunca devuelve "? – ?", que no dice
 * nada y ensucia la tarjeta.
 */
export function lineaVida(p: Persona): string {
  const n = anio(p.fechaNacimiento);
  const m = anio(p.fechaFallecimiento);
  if (p.vivo) return n ? `n. ${n}` : "";
  if (n && m) return `${n} – ${m}`;
  if (n) return `${n} – ?`;
  if (m) return `† ${m}`;
  return "falleció";
}

/** Edad actual, o edad al fallecer. `null` si falta la fecha de nacimiento. */
export function edad(p: Persona): number | null {
  const nace = anio(p.fechaNacimiento);
  if (nace === null) return null;
  const corte = p.vivo ? new Date().getFullYear() : anio(p.fechaFallecimiento);
  if (corte === null) return null;
  return corte - nace;
}

export function ordenarPorNacimiento(personas: Persona[]): Persona[] {
  return [...personas].sort(
    (a, b) =>
      fechaOrdenable(a.fechaNacimiento) - fechaOrdenable(b.fechaNacimiento) ||
      nombreCompleto(a).localeCompare(nombreCompleto(b), "es"),
  );
}

// ------------------------------------------------- relaciones derivadas
// Nada de esto se guarda: se calcula siempre desde `padres` y `parejas`.

export function padresDe(id: string, ix: Indice): Persona[] {
  const p = ix.get(id);
  if (!p) return [];
  return ordenarPorNacimiento(p.padres.map((x) => ix.get(x)).filter(Boolean) as Persona[]);
}

export function hijosDe(id: string, personas: Persona[]): Persona[] {
  return ordenarPorNacimiento(personas.filter((p) => p.padres.includes(id)));
}

export function parejasDe(id: string, ix: Indice): Persona[] {
  const p = ix.get(id);
  if (!p) return [];
  return p.parejas.map((v) => ix.get(v.personaId)).filter(Boolean) as Persona[];
}

/** Hermanos: comparten al menos un padre. Incluye medios hermanos. */
export function hermanosDe(id: string, personas: Persona[], ix: Indice): Persona[] {
  const yo = ix.get(id);
  if (!yo || yo.padres.length === 0) return [];
  const misPadres = new Set(yo.padres);
  return ordenarPorNacimiento(
    personas.filter((p) => p.id !== id && p.padres.some((x) => misPadres.has(x))),
  );
}

/**
 * Separa hermanos enteros de medio hermanos. En una familia ensamblada meterlos
 * en la misma bolsa confunde: los hijos de la otra pareja de tu papá son tus
 * medio hermanos, y conviene que la ficha lo diga y por quién.
 */
export function hermanosPorTipo(
  id: string,
  personas: Persona[],
  ix: Indice,
): { enteros: Persona[]; medios: { persona: Persona; via: Persona[] }[] } {
  const yo = ix.get(id);
  if (!yo || !yo.padres.length) return { enteros: [], medios: [] };
  const mios = new Set(yo.padres);

  const enteros: Persona[] = [];
  const medios: { persona: Persona; via: Persona[] }[] = [];

  for (const otro of personas) {
    if (otro.id === id) continue;
    const comunes = otro.padres.filter((x) => mios.has(x));
    if (!comunes.length) continue;
    // Enteros sólo si comparten exactamente el mismo par de padres.
    if (comunes.length === mios.size && otro.padres.length === yo.padres.length) {
      enteros.push(otro);
    } else {
      medios.push({
        persona: otro,
        via: comunes.map((x) => ix.get(x)).filter((p): p is Persona => !!p),
      });
    }
  }

  return {
    enteros: ordenarPorNacimiento(enteros),
    medios: medios.sort(
      (a, b) => fechaOrdenable(a.persona.fechaNacimiento) - fechaOrdenable(b.persona.fechaNacimiento),
    ),
  };
}

export function abuelosDe(id: string, ix: Indice): Persona[] {
  return unicos(padresDe(id, ix).flatMap((p) => padresDe(p.id, ix)));
}

export function nietosDe(id: string, personas: Persona[]): Persona[] {
  return unicos(hijosDe(id, personas).flatMap((h) => hijosDe(h.id, personas)));
}

/** Tíos: hermanos de los padres (y sus parejas quedan fuera, para no inflar). */
export function tiosDe(id: string, personas: Persona[], ix: Indice): Persona[] {
  const p = ix.get(id);
  if (!p) return [];
  return unicos(p.padres.flatMap((padreId) => hermanosDe(padreId, personas, ix)));
}

export function primosDe(id: string, personas: Persona[], ix: Indice): Persona[] {
  return unicos(tiosDe(id, personas, ix).flatMap((t) => hijosDe(t.id, personas)));
}

export function sobrinosDe(id: string, personas: Persona[], ix: Indice): Persona[] {
  return unicos(hermanosDe(id, personas, ix).flatMap((h) => hijosDe(h.id, personas)));
}

function unicos(lista: Persona[]): Persona[] {
  return ordenarPorNacimiento([...new Map(lista.map((p) => [p.id, p])).values()]);
}

// ------------------------------------------------------------------ métricas

export interface Metricas {
  total: number;
  vivos: number;
  fallecidos: number;
  conFoto: number;
  apellidos: { apellido: string; cuantos: number }[];
  anioMasAntiguo: number | null;
  /**
   * La cadena de ascendencia más larga cargada en todo el árbol. Es el número
   * que da nombre al proyecto. Se mide sobre el árbol entero y no desde quien
   * esté en foco: si no, mirando al ancestro más viejo marcaba cero.
   */
  generacionesArriba: number;
  /** Personas sin padres cargados: el borde del árbol, lo que falta investigar. */
  frontera: Persona[];
}

export function metricas(personas: Persona[]): Metricas {
  const ix = indexar(personas);
  const conteo = new Map<string, number>();
  for (const p of personas) {
    const ap = (p.apellidos.trim().split(/\s+/)[0] ?? "").toUpperCase();
    if (ap) conteo.set(ap, (conteo.get(ap) ?? 0) + 1);
  }

  // Cadena de ascendencia más larga del árbol, con memo y corte de ciclos.
  const profundidad = new Map<string, number>();
  const enCurso = new Set<string>();
  const subir = (id: string): number => {
    if (profundidad.has(id)) return profundidad.get(id)!;
    if (enCurso.has(id)) return 0; // ciclo: no debería pasar, pero no colgamos
    enCurso.add(id);
    const padres = (ix.get(id)?.padres ?? []).filter((x) => ix.has(x));
    const d = padres.length ? 1 + Math.max(...padres.map(subir)) : 0;
    enCurso.delete(id);
    profundidad.set(id, d);
    return d;
  };
  const generacionesArriba = personas.reduce((max, p) => Math.max(max, subir(p.id)), 0);

  return {
    total: personas.length,
    vivos: personas.filter((p) => p.vivo).length,
    fallecidos: personas.filter((p) => !p.vivo).length,
    conFoto: personas.filter((p) => p.fotos?.length).length,
    apellidos: [...conteo.entries()]
      .map(([apellido, cuantos]) => ({ apellido, cuantos }))
      .sort((a, b) => b.cuantos - a.cuantos || a.apellido.localeCompare(b.apellido, "es")),
    anioMasAntiguo: personas
      .map((p) => anio(p.fechaNacimiento))
      .filter((a): a is number => a !== null)
      .reduce<number | null>((min, a) => (min === null || a < min ? a : min), null),
    generacionesArriba,
    frontera: ordenarPorNacimiento(
      personas.filter((p) => p.padres.length === 0 && !p.vivo),
    ),
  };
}


// ------------------------------------------------------------------- dibujo

export const NODO_ANCHO = 218;
export const NODO_ALTO = 112;
/** Entre ramas hermanas. */
const HUECO_X = 28;
/** Entre miembros de una misma pareja: menor, para que se lean como una unidad. */
const HUECO_PAREJA = 12;
/** Entre familias que no comparten a nadie. */
const HUECO_FAMILIA = 96;
const HUECO_Y = 78;
const PASO_Y = NODO_ALTO + HUECO_Y;
const MARGEN = 48;

export interface NodoUbicado {
  id: string;
  persona: Persona;
  /** Generación relativa al foco: negativa hacia arriba, positiva hacia abajo. */
  gen: number;
  /** Esquina superior izquierda de la caja. */
  x: number;
  y: number;
}

/** Relación con el foco. Sólo cambia cómo se pinta; nadie se deja de dibujar. */
export type Rol = "foco" | "pareja" | "ascendente" | "descendente" | "otro";

/**
 * Punto del que cuelgan los hijos de una pareja. Que exista como cosa propia
 * —y no como una línea por cada padre— es lo que hace legibles las familias
 * ensambladas: cada hijo sale del medio de SU pareja, no del bloque entero.
 */
export interface Union {
  clave: string;
  /** Uno o dos padres. Con uno solo, la unión es esa persona. */
  personas: string[];
  /** Medio entre las cajas de los padres: de acá bajan las líneas a los hijos. */
  x: number;
  /** Borde inferior de la fila de los padres. */
  y: number;
  /** Altura de la barra que une a la pareja (centro de las cajas). */
  alturaBarra: number;
  izquierda: number;
  derecha: number;
  hijos: string[];
  /** El vínculo está cargado como pareja, no sólo deducido de un hijo común. */
  declarada: boolean;
}

export interface Diagrama {
  nodos: NodoUbicado[];
  uniones: Union[];
  ancho: number;
  alto: number;
}

const DIAGRAMA_VACIO: Diagrama = { nodos: [], uniones: [], ancho: 0, alto: 0 };

/** Estructura union-find, para agrupar a las personas en unidades familiares. */
function conjuntos(ids: string[]) {
  const jefe = new Map<string, string>(ids.map((id) => [id, id]));
  const raiz = (x: string): string => {
    let r = x;
    while (jefe.get(r) !== r) r = jefe.get(r)!;
    while (jefe.get(x) !== r) {
      const siguiente = jefe.get(x)!;
      jefe.set(x, r);
      x = siguiente;
    }
    return r;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) jefe.set(ra, rb);
  };
  return { raiz, unir };
}

function agregar<T>(mapa: Map<string, Set<T>>, clave: string, valor: T) {
  if (!mapa.has(clave)) mapa.set(clave, new Set());
  mapa.get(clave)!.add(valor);
}

/**
 * Dibuja el árbol **completo**: todas las personas cargadas, siempre. El foco
 * no filtra nada, sólo dice dónde está parado uno y se usa para resaltar.
 *
 * Antes el diagrama se armaba caminando desde el foco hacia arriba y hacia
 * abajo, así que una rama lateral —los suegros, los primos, una familia que
 * todavía no se enganchó con el resto— quedaba invisible hasta pararse encima.
 *
 * El armado tiene cuatro pasos:
 *
 *  1. **Unidades.** Las parejas y quienes comparten un hijo se agrupan en una
 *     sola unidad, que se dibuja como un bloque de cajas pegadas.
 *  2. **Niveles.** Cada unidad recibe un número de generación, relajando la
 *     regla "los hijos van al menos un nivel más abajo que sus padres". Es lo
 *     que mantiene alineada a toda una generación aunque falten eslabones.
 *  3. **Orden horizontal.** Cada unidad cuelga de UNA unidad madre (la primera,
 *     si hay dos), lo que deja un bosque; ese bosque se acomoda con el layout
 *     *tidy* clásico, midiendo de abajo hacia arriba y centrando cada bloque
 *     sobre su descendencia.
 *  4. **Empaquetado.** Los árboles sueltos se ponen uno al lado del otro.
 */
export function diagramar(personas: Persona[]): Diagrama {
  if (!personas.length) return DIAGRAMA_VACIO;

  const ix = indexar(personas);
  const orden = ordenarPorNacimiento(personas);
  const { raiz, unir } = conjuntos(personas.map((p) => p.id));

  // 1 — unidades: parejas declaradas y padres del mismo hijo.
  for (const p of personas) {
    for (const v of p.parejas) if (ix.has(v.personaId)) unir(p.id, v.personaId);
  }
  for (const hijo of personas) {
    const padres = hijo.padres.filter((id) => ix.has(id));
    for (const otro of padres.slice(1)) unir(padres[0], otro);
  }

  const miembros = new Map<string, string[]>();
  for (const p of orden) {
    const u = raiz(p.id);
    if (!miembros.has(u)) miembros.set(u, []);
    miembros.get(u)!.push(p.id);
  }
  const unidades = [...miembros.keys()];

  // Dentro de la unidad, cada quien tiene que quedar pegado a su pareja. Con
  // dos personas da igual, pero con tres —alguien que tuvo hijos con dos
  // parejas distintas— el del medio tiene que ser el que comparten: así cada
  // pareja queda contigua y sus hijos cuelgan del lugar correcto.
  const vinculadoCon = new Map<string, Set<string>>();
  const emparejar = (a: string, b: string) => {
    if (!vinculadoCon.has(a)) vinculadoCon.set(a, new Set());
    vinculadoCon.get(a)!.add(b);
  };
  for (const p of personas) {
    for (const v of p.parejas) {
      if (!ix.has(v.personaId)) continue;
      emparejar(p.id, v.personaId);
      emparejar(v.personaId, p.id);
    }
  }
  for (const hijo of personas) {
    const padres = hijo.padres.filter((id) => ix.has(id));
    for (const a of padres) for (const b of padres) if (a !== b) emparejar(a, b);
  }

  for (const u of unidades) {
    const gente = miembros.get(u)!;
    if (gente.length < 3) continue;
    const pendientes = new Set(gente);
    const grado = (id: string) =>
      [...(vinculadoCon.get(id) ?? [])].filter((x) => pendientes.has(x)).length;
    const camino: string[] = [];
    while (pendientes.size) {
      // Se arranca por una punta (grado 1) para recorrer la cadena entera.
      const inicio =
        [...pendientes].sort((a, b) => grado(a) - grado(b) || orden.indexOf(ix.get(a)!) - orden.indexOf(ix.get(b)!))[0];
      let actual: string | undefined = inicio;
      while (actual) {
        camino.push(actual);
        pendientes.delete(actual);
        actual = [...(vinculadoCon.get(actual) ?? [])]
          .filter((x) => pendientes.has(x))
          .sort((a, b) => grado(a) - grado(b))[0];
      }
    }
    miembros.set(u, camino);
  }

  const anchoUnidad = (u: string) => {
    const n = miembros.get(u)!.length;
    return n * NODO_ANCHO + HUECO_PAREJA * (n - 1);
  };

  // 2 — niveles. Aristas unidad-madre → unidad-hija.
  const hijasDe = new Map<string, Set<string>>();
  const madresDe = new Map<string, Set<string>>();
  for (const hijo of personas) {
    const uh = raiz(hijo.id);
    for (const idPadre of hijo.padres) {
      if (!ix.has(idPadre)) continue;
      const up = raiz(idPadre);
      if (up === uh) continue; // dato inconsistente: se ignora para el layout
      agregar(hijasDe, up, uh);
      agregar(madresDe, uh, up);
    }
  }

  const nivel = new Map<string, number>(unidades.map((u) => [u, 0]));
  // Relajación acotada: si algún dato armara un ciclo, corta igual.
  for (let vuelta = 0; vuelta <= unidades.length; vuelta++) {
    let cambio = false;
    for (const u of unidades) {
      for (const h of hijasDe.get(u) ?? []) {
        if (nivel.get(u)! + 1 > nivel.get(h)!) {
          nivel.set(h, nivel.get(u)! + 1);
          cambio = true;
        }
      }
    }
    if (!cambio) break;
  }

  // 3 — bosque de layout: cada unidad cuelga de una sola madre.
  const nacimiento = (u: string) => fechaOrdenable(ix.get(miembros.get(u)![0])!.fechaNacimiento);
  const hijasLayout = new Map<string, string[]>();
  const layoutMadre = new Map<string, string>();
  for (const u of unidades) {
    const candidatas = [...(madresDe.get(u) ?? [])]
      .filter((m) => nivel.get(m)! < nivel.get(u)!)
      .sort((a, b) => nacimiento(a) - nacimiento(b) || a.localeCompare(b));
    const madre = candidatas[0];
    if (madre === undefined) continue;
    layoutMadre.set(u, madre);
    if (!hijasLayout.has(madre)) hijasLayout.set(madre, []);
    hijasLayout.get(madre)!.push(u);
  }

  // Raíz del árbol de layout al que pertenece cada unidad, y orden de las raíces.
  const raizArbol = new Map<string, string>();
  const subirHastaLaRaiz = (u: string): string => {
    if (raizArbol.has(u)) return raizArbol.get(u)!;
    const camino: string[] = [];
    let actual = u;
    while (layoutMadre.has(actual) && !raizArbol.has(actual)) {
      camino.push(actual);
      actual = layoutMadre.get(actual)!;
    }
    const r = raizArbol.get(actual) ?? actual;
    for (const c of camino) raizArbol.set(c, r);
    raizArbol.set(actual, r);
    return r;
  };

  const raices = unidades
    .filter((u) => !layoutMadre.has(u))
    .sort((a, b) => nacimiento(a) - nacimiento(b) || a.localeCompare(b));
  const indiceRaiz = new Map(raices.map((r, i) => [r, i]));

  /**
   * Una unidad "puente" es la que tiene padres en dos familias distintas —una
   * pareja que se casó y trajo su propia rama—. Se la manda al borde del grupo
   * de hermanos que da hacia la otra familia, para que quede pegada a ella. Si
   * no, un hermano de sangre termina metido entre gente de otro apellido.
   */
  const ladoDe = (u: string): number => {
    const propia = indiceRaiz.get(subirHastaLaRaiz(layoutMadre.get(u) ?? u)) ?? 0;
    let lado = 0;
    for (const otra of madresDe.get(u) ?? []) {
      if (otra === layoutMadre.get(u)) continue;
      const ajena = indiceRaiz.get(subirHastaLaRaiz(otra));
      if (ajena === undefined || ajena === propia) continue;
      lado = ajena > propia ? 1 : -1;
    }
    return lado;
  };

  /**
   * Dónde cae, dentro del bloque de la unidad madre, la pareja de la que
   * cuelga esta unidad hija. Ordenar por esto agrupa a los hijos debajo de SU
   * pareja: sin esto, en una familia ensamblada los hijos de una y otra pareja
   * quedan mezclados y las líneas se cruzan.
   */
  const anclaje = (hija: string, madre: string): number => {
    const bloque = miembros.get(madre)!;
    const posiciones: number[] = [];
    for (const idHijo of miembros.get(hija)!) {
      for (const idPadre of ix.get(idHijo)?.padres ?? []) {
        const i = bloque.indexOf(idPadre);
        if (i >= 0) posiciones.push(i);
      }
    }
    if (!posiciones.length) return 0;
    return posiciones.reduce((s, v) => s + v, 0) / posiciones.length;
  };

  for (const [madre, lista] of hijasLayout) {
    lista.sort(
      (a, b) =>
        ladoDe(a) - ladoDe(b) ||
        anclaje(a, madre) - anclaje(b, madre) ||
        nacimiento(a) - nacimiento(b) ||
        a.localeCompare(b),
    );
  }

  const ancho = new Map<string, number>();
  const medir = (u: string): number => {
    const hijas = hijasLayout.get(u) ?? [];
    const anchoHijas =
      hijas.reduce((s, h) => s + medir(h), 0) + HUECO_X * Math.max(0, hijas.length - 1);
    const w = Math.max(anchoUnidad(u), anchoHijas);
    ancho.set(u, w);
    return w;
  };

  const centro = new Map<string, number>();
  const colocar = (u: string, xIzq: number) => {
    const w = ancho.get(u)!;
    const c = xIzq + w / 2;
    centro.set(u, c);
    const hijas = hijasLayout.get(u) ?? [];
    const anchoHijas =
      hijas.reduce((s, h) => s + ancho.get(h)!, 0) + HUECO_X * Math.max(0, hijas.length - 1);
    let cursor = c - anchoHijas / 2;
    for (const h of hijas) {
      colocar(h, cursor);
      cursor += ancho.get(h)! + HUECO_X;
    }
  };

  // 4 — empaquetado de los árboles sueltos, del más viejo al más nuevo.
  let cursor = 0;
  for (const r of raices) {
    medir(r);
    colocar(r, cursor);
    cursor += ancho.get(r)! + HUECO_FAMILIA;
  }

  const nivelMin = Math.min(...unidades.map((u) => nivel.get(u)!));

  const nodos: NodoUbicado[] = [];
  for (const u of unidades) {
    const gente = miembros.get(u)!;
    let x = centro.get(u)! - anchoUnidad(u) / 2;
    for (const id of gente) {
      nodos.push({
        id,
        persona: ix.get(id)!,
        gen: nivel.get(u)!,
        x: x + MARGEN,
        y: (nivel.get(u)! - nivelMin) * PASO_Y + MARGEN,
      });
      x += NODO_ANCHO + HUECO_PAREJA;
    }
  }

  // ---------------------------------------------------------------- vínculos
  //
  // Los hijos NO cuelgan de cada padre por separado ni del bloque entero: cada
  // par de padres tiene su "punto de unión" —el medio exacto entre las dos
  // cajas— y de ahí baja una sola línea a cada hijo. Es lo que distingue a las
  // familias ensambladas: si alguien tuvo hijos con dos personas distintas, se
  // ve de cuál pareja viene cada hijo en vez de parecer que son de los tres.
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const uniones = new Map<string, Union>();

  const claveUnion = (padres: string[]) => [...padres].sort().join("|");

  const registrarUnion = (padres: string[]): Union | null => {
    const puestos = padres.map((id) => porId.get(id)).filter((n): n is NodoUbicado => !!n);
    if (!puestos.length) return null;
    const clave = claveUnion(puestos.map((n) => n.id));
    const existente = uniones.get(clave);
    if (existente) return existente;

    const centros = puestos.map((n) => n.x + NODO_ANCHO / 2);
    const base = Math.max(...puestos.map((n) => n.y));

    // La barra va por el hueco ENTRE las cajas, no de centro a centro: así no
    // depende de que las cajas se dibujen encima para taparla, y se ve que une
    // a esas dos personas y no a las de al lado.
    const ordenados = [...puestos].sort((a, b) => a.x - b.x);
    const bordeIzq = ordenados[0].x + NODO_ANCHO;
    const bordeDer = ordenados[ordenados.length - 1].x;
    const hayHueco = puestos.length > 1 && bordeDer - bordeIzq >= 2;

    const union: Union = {
      clave,
      personas: puestos.map((n) => n.id),
      x: hayHueco
        ? (bordeIzq + bordeDer) / 2
        : centros.reduce((s, c) => s + c, 0) / centros.length,
      // Las líneas a los hijos salen del borde inferior de la fila.
      y: base + NODO_ALTO,
      alturaBarra: base + NODO_ALTO / 2,
      izquierda: hayHueco ? bordeIzq : Math.min(...centros),
      derecha: hayHueco ? bordeDer : Math.max(...centros),
      hijos: [],
      declarada: false,
    };
    uniones.set(clave, union);
    return union;
  };

  // Uniones que vienen de tener hijos en común.
  for (const p of personas) {
    const padres = p.padres.filter((id) => porId.has(id));
    if (!padres.length) continue;
    const union = registrarUnion(padres);
    if (union) union.hijos.push(p.id);
  }

  // Uniones declaradas como pareja aunque todavía no tengan hijos cargados.
  for (const p of personas) {
    for (const v of p.parejas) {
      if (!porId.has(v.personaId)) continue;
      const union = registrarUnion([p.id, v.personaId]);
      if (union) union.declarada = true;
    }
  }

  const nivelMax = Math.max(...unidades.map((u) => nivel.get(u)!));
  return {
    nodos,
    uniones: [...uniones.values()],
    ancho: Math.max(...nodos.map((n) => n.x + NODO_ANCHO)) + MARGEN,
    alto: (nivelMax - nivelMin) * PASO_Y + NODO_ALTO + MARGEN * 2,
  };
}

/**
 * Cómo se relaciona cada persona con el foco. Va aparte del layout a propósito:
 * cambiar de foco no puede rearmar el diagrama ni mover la cámara, sólo cambia
 * a quién se resalta.
 */
export function rolesRespectoA(personas: Persona[], focoId: string | null): Map<string, Rol> {
  const roles = new Map<string, Rol>();
  const ix = indexar(personas);
  if (!focoId || !ix.has(focoId)) return roles;

  const recorrer = (siguientes: (id: string) => string[]) => {
    const vistos = new Set<string>();
    // La copia NO es opcional: `siguientes` devuelve el array `padres` de la
    // persona tal cual está guardado, y `pop()` sobre él lo vaciaría. Ese bug
    // borraba los vínculos en memoria con sólo seleccionar a alguien, y los
    // borraba de verdad en cuanto se guardaba la ficha.
    const pila = [...siguientes(focoId)];
    while (pila.length) {
      const id = pila.pop()!;
      if (vistos.has(id) || !ix.has(id)) continue;
      vistos.add(id);
      pila.push(...siguientes(id));
    }
    return vistos;
  };

  for (const id of recorrer((x) => ix.get(x)?.padres ?? [])) roles.set(id, "ascendente");
  for (const id of recorrer((x) => hijosDe(x, personas).map((h) => h.id))) {
    roles.set(id, "descendente");
  }
  for (const v of ix.get(focoId)!.parejas) if (ix.has(v.personaId)) roles.set(v.personaId, "pareja");
  roles.set(focoId, "foco");
  return roles;
}
