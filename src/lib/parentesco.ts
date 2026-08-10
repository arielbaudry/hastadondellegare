import { indexar, ordenarPorNacimiento, type Indice } from "./tree";
import type { Persona } from "./types";

/**
 * Cómo se llama cada persona del árbol respecto de otra: "tía abuela", "primo
 * segundo", "bisnieta", "cuñado". Se calcula, no se carga.
 *
 * El método es el clásico de genealogía: se busca el antepasado común más
 * cercano y se miran las dos distancias hasta él. Con `a` = cuánto sube el
 * primero y `b` = cuánto sube el segundo:
 *
 *   a=0            -> el otro es ascendiente directo (padre, abuelo, bisabuelo…)
 *   b=0            -> es descendiente directo (hijo, nieto, bisnieto…)
 *   a=1, b=1       -> hermanos
 *   a=1, b>1       -> sobrinos (nietos, bisnietos…)
 *   a>1, b=1       -> tíos (abuelos, bisabuelos…)
 *   a>1, b>1       -> primos de grado min(a,b)-1, removidos |a-b| veces
 *
 * Lo que no sale por sangre se busca por afinidad: la pareja de un pariente, o
 * el pariente de la pareja (suegros, cuñados, yernos, tíos políticos).
 */

/** Las dos formas de un mismo vínculo; el género decide cuál se muestra. */
interface Formas {
  m: string;
  f: string;
}

export interface Parentesco {
  /** Etiqueta lista para mostrar, ya con el género de la persona. */
  etiqueta: string;
  /** Forma neutra ("tío/a abuelo/a"), para grupos de género mezclado. */
  neutro: string;
  /** Agrupa a quienes tienen el mismo vínculo. */
  clave: string;
  /** Menor es más cercano: ordena la ficha de adentro hacia afuera. */
  orden: number;
}

/** Une la forma masculina y la femenina cuando no se sabe el género. */
function ambos(m: string, f: string): string {
  return m
    .split(" ")
    .map((palabra, i) => {
      const otra = f.split(" ")[i] ?? palabra;
      if (palabra === otra) return palabra;
      // "tío"/"tía" -> "tío/a";  "padre"/"madre" -> "padre o madre"
      return palabra.slice(0, -1) === otra.slice(0, -1)
        ? `${palabra}/${otra.slice(-1)}`
        : `${palabra} o ${otra}`;
    })
    .join(" ");
}

/** Deshace `ambos()`: de "tío/a abuelo/a" vuelve a "tío abuelo" y "tía abuela". */
function separar(neutro: string): Formas {
  const partes = neutro.split(" ");
  return {
    m: partes.map((x) => (x.includes("/") ? x.split("/")[0] : x.includes(" o ") ? x : x)).join(" "),
    f: partes
      .map((x) => {
        if (!x.includes("/")) return x;
        const [base, term] = x.split("/");
        return base.slice(0, -1) + term;
      })
      .join(" "),
  };
}

function segun(p: Persona, { m, f }: Formas): string {
  if (p.genero === "M") return m;
  if (p.genero === "F") return f;
  return ambos(m, f);
}

/** Arma el resultado final resolviendo el género recién al mostrar. */
function armar(otro: Persona, formas: Formas, clave: string, orden: number): Parentesco {
  return { etiqueta: segun(otro, formas), neutro: ambos(formas.m, formas.f), clave, orden };
}

const GRADO = ["", "bis", "tatara", "tatatara"];

/** "abuelo", "bisabuelo", "tatarabuelo"… según cuántas generaciones sube. */
function ascendiente(n: number): Formas {
  if (n === 1) return { m: "padre", f: "madre" };
  if (n === 2) return { m: "abuelo", f: "abuela" };
  const pre = GRADO[n - 2] ?? `${n - 2}× tatara`;
  return { m: `${pre}abuelo`, f: `${pre}abuela` };
}

function descendiente(n: number): Formas {
  if (n === 1) return { m: "hijo", f: "hija" };
  if (n === 2) return { m: "nieto", f: "nieta" };
  const pre = GRADO[n - 2] ?? `${n - 2}× tatara`;
  return { m: `${pre}nieto`, f: `${pre}nieta` };
}

const ORDINAL: [string, string][] = [
  ["", ""], ["", ""], ["segundo", "segunda"], ["tercero", "tercera"],
  ["cuarto", "cuarta"], ["quinto", "quinta"], ["sexto", "sexta"],
];

/** Antepasados de alguien con la distancia mínima a cada uno. */
function ascendientes(id: string, ix: Indice): Map<string, number> {
  const dist = new Map<string, number>([[id, 0]]);
  let nivel = [id];
  let d = 0;
  while (nivel.length && d < 30) {
    d += 1;
    const siguiente: string[] = [];
    for (const actual of nivel) {
      for (const padre of ix.get(actual)?.padres ?? []) {
        if (!ix.has(padre) || dist.has(padre)) continue;
        dist.set(padre, d);
        siguiente.push(padre);
      }
    }
    nivel = siguiente;
  }
  return dist;
}

/** Parentesco de sangre. `null` si no comparten ningún antepasado cargado. */
function porSangre(
  desde: string,
  hacia: string,
  ix: Indice,
): Parentesco | null {
  const a = ascendientes(desde, ix);
  const b = ascendientes(hacia, ix);
  const otro = ix.get(hacia)!;
  const yo = ix.get(desde)!;

  if (a.has(hacia)) {
    const n = a.get(hacia)!;
    return armar(otro, ascendiente(n), `asc-${n}`, n);
  }
  if (b.has(desde)) {
    const n = b.get(desde)!;
    return armar(otro, descendiente(n), `desc-${n}`, 100 + n);
  }

  // Antepasado común que minimice la distancia total.
  let mejor: { a: number; b: number } | null = null;
  for (const [id, da] of a) {
    const db = b.get(id);
    if (db === undefined) continue;
    if (!mejor || Math.max(da, db) < Math.max(mejor.a, mejor.b) || da + db < mejor.a + mejor.b) {
      mejor = { a: da, b: db };
    }
  }
  if (!mejor) return null;
  const { a: da, b: db } = mejor;

  if (da === 1 && db === 1) {
    const compartidos = otro.padres.filter((x) => yo.padres.includes(x)).length;
    const medio = compartidos < Math.min(yo.padres.length, otro.padres.length) || compartidos < 2;
    return medio
      ? armar(otro, { m: "medio hermano", f: "media hermana" }, "medio-hermano", 11)
      : armar(otro, { m: "hermano", f: "hermana" }, "hermano", 10);
  }

  if (da === 1) {
    const g = db - 1;
    const base = g === 1 ? "" : g === 2 ? " nieto" : ` ${GRADO[g - 1] ?? ""}nieto`;
    const baseF = g === 1 ? "" : g === 2 ? " nieta" : ` ${GRADO[g - 1] ?? ""}nieta`;
    return armar(otro, { m: `sobrino${base}`, f: `sobrina${baseF}` }, `sobrino-${g}`, 120 + g);
  }

  if (db === 1) {
    const g = da - 1;
    const base = g === 1 ? "" : g === 2 ? " abuelo" : ` ${GRADO[g - 1] ?? ""}abuelo`;
    const baseF = g === 1 ? "" : g === 2 ? " abuela" : ` ${GRADO[g - 1] ?? ""}abuela`;
    return armar(otro, { m: `tío${base}`, f: `tía${baseF}` }, `tio-${g}`, 20 + g);
  }

  const grado = Math.min(da, db) - 1;
  const removido = Math.abs(da - db);
  const par = ORDINAL[grado + 1] ?? [`de grado ${grado}`, `de grado ${grado}`];
  // "removido" es el término técnico, pero nadie lo dice: se explica en criollo.
  const sufijo =
    removido === 0
      ? ""
      : removido === 1
        ? " (de otra generación)"
        : ` (a ${removido} generaciones)`;
  return armar(
    otro,
    {
      m: `primo${grado > 1 ? ` ${par[0]}` : ""}${sufijo}`,
      f: `prima${grado > 1 ? ` ${par[1]}` : ""}${sufijo}`,
    },
    `primo-${grado}-${removido}`,
    40 + grado * 2 + removido,
  );
}

/**
 * Parentesco completo, incluyendo el político. Devuelve `null` cuando no hay
 * ningún camino entre las dos personas.
 */
export function parentescoCon(
  desde: string,
  hacia: string,
  personas: Persona[],
  ix: Indice = indexar(personas),
): Parentesco | null {
  if (desde === hacia) return null;
  const yo = ix.get(desde);
  const otro = ix.get(hacia);
  if (!yo || !otro) return null;

  const vinculo = yo.parejas.find((v) => v.personaId === hacia);
  if (vinculo) {
    const formas: Formas =
      vinculo.tipo === "casado"
        ? { m: "esposo", f: "esposa" }
        : vinculo.tipo === "separado"
          ? { m: "ex pareja", f: "ex pareja" }
          : { m: "pareja", f: "pareja" };
    return armar(otro, formas, "pareja", 1);
  }

  const sangre = porSangre(desde, hacia, ix);
  if (sangre) return sangre;

  // Afinidad 1: es la pareja de un pariente mío (cuñado, tío político, yerno…).
  for (const v of otro.parejas) {
    const p = porSangre(desde, v.personaId, ix);
    if (!p) continue;
    if (p.clave === "hermano" || p.clave === "medio-hermano") {
      return armar(otro, { m: "cuñado", f: "cuñada" }, "cunado", 12);
    }
    if (p.clave === "desc-1") return armar(otro, { m: "yerno", f: "nuera" }, "yerno", 102);
    if (p.clave === "asc-1") {
      return armar(otro, { m: "padrastro", f: "madrastra" }, "padrastro", 2.5);
    }
    // "político" tiene que concordar con la misma forma que lo precede.
    const base = separar(p.neutro);
    return armar(
      otro,
      { m: `${base.m} político`, f: `${base.f} política` },
      `${p.clave}-politico`,
      p.orden + 0.5,
    );
  }

  // Afinidad 2: es pariente de mi pareja (suegros, cuñados, concuñados).
  for (const v of yo.parejas) {
    const p = porSangre(v.personaId, hacia, ix);
    if (!p) continue;
    if (p.clave === "desc-1") {
      return armar(otro, { m: "hijastro", f: "hijastra" }, "hijastro", 101.5);
    }
    if (p.clave === "asc-1") return armar(otro, { m: "suegro", f: "suegra" }, "suegro", 3);
    if (p.clave === "hermano" || p.clave === "medio-hermano") {
      return armar(otro, { m: "cuñado", f: "cuñada" }, "cunado", 12);
    }
    const quien = ix.get(v.personaId)!.nombres.split(" ")[0];
    const base = separar(p.neutro);
    return armar(
      otro,
      { m: `${base.m} de ${quien}`, f: `${base.f} de ${quien}` },
      `pareja-${p.clave}`,
      p.orden + 0.6,
    );
  }

  return null;
}

export interface GrupoParentesco {
  clave: string;
  titulo: string;
  gente: Persona[];
  orden: number;
}

/** Todo el linaje de una persona, agrupado por vínculo y de lo cercano a lo lejano. */
export function linajeDe(id: string, personas: Persona[]): GrupoParentesco[] {
  const ix = indexar(personas);
  const grupos = new Map<string, GrupoParentesco>();

  for (const otro of personas) {
    const p = parentescoCon(id, otro.id, personas, ix);
    if (!p) continue;
    const g = grupos.get(p.clave);
    if (g) {
      g.gente.push(otro);
      // El título sólo lleva género si TODO el grupo lo comparte; con géneros
      // mezclados —o alguno sin dato— va la forma neutra.
      if (g.titulo !== p.etiqueta) g.titulo = p.neutro;
    } else {
      grupos.set(p.clave, { clave: p.clave, titulo: p.etiqueta, gente: [otro], orden: p.orden });
    }
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, gente: ordenarPorNacimiento(g.gente) }))
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"));
}
