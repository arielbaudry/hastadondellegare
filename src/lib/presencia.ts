/**
 * Quién está mirando el árbol en este momento.
 *
 * Se lleva **en memoria del servidor**, no en el almacenamiento del árbol, y es
 * a propósito: con el árbol guardado como un archivo en GitHub, anotar cada
 * latido sería un commit cada veinte segundos por persona. La presencia es
 * información que se vence sola; no merece historial.
 *
 * La contra, dicha de frente: si el sitio corriera en varias instancias a la
 * vez, cada una vería sólo a los suyos y el número saldría bajo. Para una
 * familia entrando de a poco no pasa, y el error posible es contar de menos
 * —nunca inventar gente— que es el lado correcto para equivocarse.
 */

const VENCE = 70_000; // sin latido en 70 s, se considera que se fue
const LATIDO = 25_000; // cada cuánto late el navegador

interface Visitante {
  nombre: string;
  visto: number;
}

const visitantes = new Map<string, Visitante>();

function limpiar(): void {
  const corte = Date.now() - VENCE;
  for (const [id, v] of visitantes) if (v.visto < corte) visitantes.delete(id);
}

/** Registra el latido de alguien y devuelve la lista de presentes. */
export function latir(id: string, nombre: string): string[] {
  limpiar();
  if (id) visitantes.set(id, { nombre: nombre.trim().slice(0, 60) || "Alguien", visto: Date.now() });
  return conectados();
}

export function conectados(): string[] {
  limpiar();
  return [...visitantes.values()]
    .map((v) => v.nombre)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export function irse(id: string): void {
  visitantes.delete(id);
}

export const MS_LATIDO = LATIDO;
