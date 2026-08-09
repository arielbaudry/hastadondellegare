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

export interface Parentesco {
  /** Etiqueta lista para mostrar, ya con el género de la persona. */
  etiqueta: string;
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

function segun(p: Persona, m: string, f: string): string {
  if (p.genero === "M") return m;
  if (p.genero === "F") return f;
  return ambos(m, f);
}

const GRADO = ["", "bis", "tatara", "tatatara"];

/** "abuelo", "bisabuelo", "tatarabuelo"… según cuántas generaciones sube. */
function ascendiente(n: number, p: Persona): string {
  if (n === 1) return segun(p, "padre", "madre");
  if (n === 2) return segun(p, "abuelo", "abuela");
  const pre = GRADO[n - 2] ?? `${n - 2}× tatara`;
  return segun(p, `${pre}abuelo`, `${pre}abuela`);
}

function descendiente(n: number, p: Persona): string {
  if (n === 1) return segun(p, "hijo", "hija");
  if (n === 2) return segun(p, "nieto", "nieta");
  const pre = GRADO[n - 2] ?? `${n - 2}× tatara`;
  return segun(p, `${pre}nieto`, `${pre}nieta`);
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
    return { etiqueta: ascendiente(n, otro), clave: `asc-${n}`, orden: n };
  }
  if (b.has(desde)) {
    const n = b.get(desde)!;
    return { etiqueta: descendiente(n, otro), clave: `desc-${n}`, orden: 100 + n };
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
      ? { etiqueta: segun(otro, "medio hermano", "media hermana"), clave: "medio-hermano", orden: 11 }
      : { etiqueta: segun(otro, "hermano", "hermana"), clave: "hermano", orden: 10 };
  }

  if (da === 1) {
    const g = db - 1;
    const base = g === 1 ? "" : g === 2 ? " nieto" : ` ${GRADO[g - 1] ?? ""}nieto`;
    const baseF = g === 1 ? "" : g === 2 ? " nieta" : ` ${GRADO[g - 1] ?? ""}nieta`;
    return {
      etiqueta: segun(otro, `sobrino${base}`, `sobrina${baseF}`),
      clave: `sobrino-${g}`,
      orden: 120 + g,
    };
  }

  if (db === 1) {
    const g = da - 1;
    const base = g === 1 ? "" : g === 2 ? " abuelo" : ` ${GRADO[g - 1] ?? ""}abuelo`;
    const baseF = g === 1 ? "" : g === 2 ? " abuela" : ` ${GRADO[g - 1] ?? ""}abuela`;
    return {
      etiqueta: segun(otro, `tío${base}`, `tía${baseF}`),
      clave: `tio-${g}`,
      orden: 20 + g,
    };
  }

  const grado = Math.min(da, db) - 1;
  const removido = Math.abs(da - db);
  const par = ORDINAL[grado + 1] ?? [`de grado ${grado}`, `de grado ${grado}`];
  const ordinal = grado > 1 ? ` ${segun(otro, par[0], par[1])}` : "";
  // "removido" es el término técnico, pero nadie lo dice: se explica en criollo.
  const sufijo =
    removido === 0
      ? ""
      : removido === 1
        ? " (de otra generación)"
        : ` (a ${removido} generaciones)`;
  return {
    etiqueta: `${segun(otro, "primo", "prima")}${ordinal}${sufijo}`,
    clave: `primo-${grado}-${removido}`,
    orden: 40 + grado * 2 + removido,
  };
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
    const etiqueta =
      vinculo.tipo === "casado"
        ? segun(otro, "esposo", "esposa")
        : vinculo.tipo === "separado"
          ? segun(otro, "ex pareja", "ex pareja")
          : segun(otro, "pareja", "pareja");
    return { etiqueta, clave: "pareja", orden: 1 };
  }

  const sangre = porSangre(desde, hacia, ix);
  if (sangre) return sangre;

  // Afinidad 1: es la pareja de un pariente mío (cuñado, tío político, yerno…).
  for (const v of otro.parejas) {
    const p = porSangre(desde, v.personaId, ix);
    if (!p) continue;
    if (p.clave === "hermano" || p.clave === "medio-hermano") {
      return { etiqueta: segun(otro, "cuñado", "cuñada"), clave: "cunado", orden: 12 };
    }
    if (p.clave === "desc-1") {
      return { etiqueta: segun(otro, "yerno", "nuera"), clave: "yerno", orden: 102 };
    }
    if (p.clave === "asc-1") {
      return { etiqueta: segun(otro, "padrastro", "madrastra"), clave: "padrastro", orden: 2.5 };
    }
    return {
      etiqueta: `${p.etiqueta} político${otro.genero === "F" ? "" : ""}`.replace(
        /político$/,
        otro.genero === "F" ? "política" : otro.genero === "M" ? "político" : "político/a",
      ),
      clave: `${p.clave}-politico`,
      orden: p.orden + 0.5,
    };
  }

  // Afinidad 2: es pariente de mi pareja (suegros, cuñados, concuñados).
  for (const v of yo.parejas) {
    const p = porSangre(v.personaId, hacia, ix);
    if (!p) continue;
    if (p.clave === "desc-1") {
      return { etiqueta: segun(otro, "hijastro", "hijastra"), clave: "hijastro", orden: 101.5 };
    }
    if (p.clave === "asc-1") {
      return { etiqueta: segun(otro, "suegro", "suegra"), clave: "suegro", orden: 3 };
    }
    if (p.clave === "hermano" || p.clave === "medio-hermano") {
      return { etiqueta: segun(otro, "cuñado", "cuñada"), clave: "cunado", orden: 12 };
    }
    return {
      etiqueta: `${p.etiqueta} de ${ix.get(v.personaId)!.nombres.split(" ")[0]}`,
      clave: `pareja-${p.clave}`,
      orden: p.orden + 0.6,
    };
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
      // Con géneros mezclados gana la forma neutra del primero que la tenga.
      if (g.titulo !== p.etiqueta && p.etiqueta.includes("/")) g.titulo = p.etiqueta;
    } else {
      grupos.set(p.clave, { clave: p.clave, titulo: p.etiqueta, gente: [otro], orden: p.orden });
    }
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, gente: ordenarPorNacimiento(g.gente) }))
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es"));
}
