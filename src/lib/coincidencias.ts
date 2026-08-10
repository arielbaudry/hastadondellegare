import { nombreCompleto } from "./tree";
import type { Persona } from "./types";

/**
 * Buscar a quien entra dentro del árbol por el nombre que escribió.
 *
 * La gente no escribe su nombre como quedó cargado: pone "Ariel" donde la ficha
 * dice "Ariel Osvaldo Baudry", o "maria cecilia" sin acentos ni apellido. Por
 * eso no alcanza con comparar cadenas: se comparan palabras, y se ofrece elegir
 * cuando hay más de una posible.
 */

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabras(s: string): string[] {
  return normalizar(s).split(" ").filter((p) => p.length > 1);
}

/** Distancia de edición, acotada: sirve para perdonar un error de tipeo. */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 9;
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        previo + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previo = tmp;
    }
  }
  return fila[b.length];
}

export interface Coincidencia {
  persona: Persona;
  /** 0 a 1. Uno es "es exactamente esta persona". */
  puntaje: number;
}

/**
 * Personas que podrían ser quien escribió `texto`, de la más probable a la
 * menos. Devuelve vacío si no se parece a nadie.
 */
export function buscarPersona(texto: string, personas: Persona[]): Coincidencia[] {
  const busca = palabras(texto);
  if (!busca.length) return [];

  const resultados: Coincidencia[] = [];

  for (const p of personas) {
    // Se ignoran las fichas marcador: nadie se llama "Padre o madre".
    if (normalizar(p.nombres).startsWith("padre o madre")) continue;

    const suyas = palabras(`${p.nombres} ${p.apellidos} ${p.apodo ?? ""} ${p.apellidoNacimiento ?? ""}`);
    if (!suyas.length) continue;

    let aciertos = 0;
    for (const b of busca) {
      if (suyas.some((s) => s === b || distancia(s, b) <= 1)) aciertos += 1;
    }
    if (!aciertos) continue;

    // Pesa más haber acertado TODO lo que la persona escribió que haber
    // coincidido con muchas palabras de una ficha larga.
    const cubreLoEscrito = aciertos / busca.length;
    const cubreLaFicha = aciertos / suyas.length;
    const puntaje = cubreLoEscrito * 0.75 + cubreLaFicha * 0.25;

    if (puntaje >= 0.4) resultados.push({ persona: p, puntaje });
  }

  return resultados
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        nombreCompleto(a.persona).localeCompare(nombreCompleto(b.persona), "es"),
    )
    .slice(0, 6);
}

/**
 * No hace falta preguntar: o hay una sola candidata clara, o la primera es
 * exacta y la siguiente queda muy atrás.
 */
export function esInequivoca(c: Coincidencia[]): boolean {
  if (!c.length) return false;
  if (c.length === 1) return c[0].puntaje >= 0.85;
  return c[0].puntaje >= 0.98 && (c[1]?.puntaje ?? 0) <= 0.85;
}

/**
 * El nombre con el que queda registrado quien edita. "Ariel", "Ariel Baudry" y
 * "Ariel Osvaldo Baudry" son la misma persona, y en la bitácora tienen que
 * figurar igual: si no, parecen tres.
 *
 * Es más permisivo que `esInequivoca()` a propósito. Ahí la pregunta es "¿te
 * abro el árbol en esta ficha?" y equivocarse molesta; acá es sólo cómo se
 * escribe un nombre en un registro. Ante la duda —dos personas igual de
 * parecidas, un apellido suelto— se deja tal cual vino.
 */
export function nombreCanonico(
  texto: string,
  personas: Persona[],
  /** Cuántos movimientos tiene ya cada nombre completo. Desempata. */
  actividad?: Map<string, number>,
): string {
  const limpio = texto.trim();
  const c = buscarPersona(limpio, personas);
  if (!c.length) return limpio;

  const [mejor, segundo] = c;
  if (mejor.puntaje >= 0.6 && (!segundo || mejor.puntaje >= segundo.puntaje * 1.25)) {
    return nombreCompleto(mejor.persona);
  }

  // Empate de verdad: en esta familia hay dos Arieles, y "Ariel" a secas se
  // parece igual a los dos. Gana el que viene editando el árbol — quien nunca
  // lo tocó no firmó ese movimiento. Si los dos editan, no hay manera de saber
  // y el nombre queda como se escribió.
  if (actividad?.size) {
    const empatados = c.filter((x) => x.puntaje * 1.25 >= mejor.puntaje);
    const activos = empatados.filter((x) => (actividad.get(nombreCompleto(x.persona)) ?? 0) > 0);
    if (activos.length === 1) return nombreCompleto(activos[0].persona);
  }
  return limpio;
}
