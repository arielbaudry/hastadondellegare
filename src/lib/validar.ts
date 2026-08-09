import { randomUUID } from "node:crypto";
import type { Arbol, Pareja, Persona, PersonaEntrada, TipoPareja } from "./types";

export class ErrorDeDatos extends Error {}

const TIPOS_PAREJA: TipoPareja[] = ["casado", "pareja", "separado", "viudo"];
const RE_FECHA = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function texto(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const limpio = v.trim().slice(0, max);
  return limpio || undefined;
}

function fecha(v: unknown, campo: string): string | undefined {
  const t = texto(v, 10);
  if (!t) return undefined;
  if (!RE_FECHA.test(t)) {
    throw new ErrorDeDatos(`${campo}: usá AAAA, AAAA-MM o AAAA-MM-DD (recibí "${t}").`);
  }
  return t;
}

/** Convierte lo que manda el navegador en una Persona válida. */
export function sanearPersona(
  entrada: unknown,
  anterior: Persona | null,
  autor?: string,
): Persona {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const ahora = new Date().toISOString();

  const nombres = texto(e.nombres, 120);
  const apellidos = texto(e.apellidos, 120);
  if (!nombres) throw new ErrorDeDatos("Falta el nombre.");
  if (!apellidos) throw new ErrorDeDatos("Falta el apellido.");

  const vivo = e.vivo === undefined ? (anterior?.vivo ?? true) : Boolean(e.vivo);
  const fechaFallecimiento = fecha(e.fechaFallecimiento, "Fecha de fallecimiento");
  if (vivo && fechaFallecimiento) {
    throw new ErrorDeDatos("Está marcada como viva pero tiene fecha de fallecimiento.");
  }

  const nacimiento = fecha(e.fechaNacimiento, "Fecha de nacimiento");
  if (nacimiento && fechaFallecimiento && fechaFallecimiento < nacimiento) {
    throw new ErrorDeDatos("La fecha de fallecimiento es anterior a la de nacimiento.");
  }

  // `fotoUrl` es el campo viejo de una sola foto: se migra a la lista.
  const fotos = Array.isArray(e.fotos)
    ? [...new Set((e.fotos as unknown[]).filter((f): f is string => typeof f === "string" && !!f))].slice(0, 24)
    : typeof e.fotoUrl === "string" && e.fotoUrl
      ? [e.fotoUrl]
      : (anterior?.fotos ?? []);

  const padres = Array.isArray(e.padres)
    ? [...new Set(e.padres.filter((x): x is string => typeof x === "string" && !!x))].slice(0, 2)
    : (anterior?.padres ?? []);

  const parejas: Pareja[] = Array.isArray(e.parejas)
    ? (e.parejas as Record<string, unknown>[])
        .filter((v) => typeof v?.personaId === "string" && v.personaId)
        .map((v) => ({
          personaId: v.personaId as string,
          tipo: TIPOS_PAREJA.includes(v.tipo as TipoPareja) ? (v.tipo as TipoPareja) : "pareja",
          desde: fecha(v.desde, "Pareja desde"),
          hasta: fecha(v.hasta, "Pareja hasta"),
        }))
    : (anterior?.parejas ?? []);

  return {
    id: anterior?.id ?? randomUUID(),
    nombres,
    apellidos,
    apodo: texto(e.apodo, 60),
    genero: e.genero === "F" || e.genero === "M" ? e.genero : undefined,
    apellidoNacimiento: texto(e.apellidoNacimiento, 120),
    fotos,
    fechaNacimiento: nacimiento,
    lugarNacimiento: texto(e.lugarNacimiento, 160),
    vivo,
    fechaFallecimiento,
    celular: texto(e.celular, 40),
    email: texto(e.email, 160),
    direccion: texto(e.direccion, 240),
    notas: texto(e.notas, 4000),
    padres,
    parejas,
    creadoPor: anterior?.creadoPor ?? texto(autor, 80),
    actualizadoPor: texto(autor, 80) ?? anterior?.actualizadoPor,
    creadoEn: anterior?.creadoEn ?? ahora,
    actualizadoEn: ahora,
  };
}

/**
 * Deja el árbol coherente después de cualquier escritura:
 *
 *  1. borra vínculos a personas que ya no existen y auto-referencias;
 *  2. hace recíprocas las parejas (si A dice ser pareja de B, B lo dice de A);
 *  3. corta ciclos de filiación — nadie puede ser ancestro de sí mismo.
 *
 * Se corre siempre, así el árbol nunca queda inconsistente aunque el cliente
 * mande cualquier cosa.
 */
export function normalizar(arbol: Arbol): void {
  const ix = new Map(arbol.personas.map((p) => [p.id, p]));

  for (const p of arbol.personas) {
    p.padres = p.padres.filter((id) => id !== p.id && ix.has(id));
    p.parejas = p.parejas.filter((v) => v.personaId !== p.id && ix.has(v.personaId));
  }

  // Ciclos: si un "padre" es en realidad descendiente, el vínculo está mal cargado.
  for (const p of arbol.personas) {
    p.padres = p.padres.filter((padreId) => !esDescendiente(padreId, p.id, ix));
  }

  // Reciprocidad de parejas.
  for (const p of arbol.personas) {
    for (const v of p.parejas) {
      const otro = ix.get(v.personaId)!;
      const espejo = otro.parejas.find((w) => w.personaId === p.id);
      if (espejo) {
        espejo.tipo = v.tipo;
        espejo.desde = v.desde;
        espejo.hasta = v.hasta;
      } else {
        otro.parejas.push({ personaId: p.id, tipo: v.tipo, desde: v.desde, hasta: v.hasta });
      }
    }
  }
}

/** ¿`candidato` cuelga de `raiz` bajando por hijos? Recorre con corte de ciclos. */
function esDescendiente(candidato: string, raiz: string, ix: Map<string, Persona>): boolean {
  const vistos = new Set<string>();
  const pila = [raiz];
  while (pila.length) {
    const actual = pila.pop()!;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    for (const p of ix.values()) {
      if (!p.padres.includes(actual)) continue;
      if (p.id === candidato) return true;
      pila.push(p.id);
    }
  }
  return false;
}

/** Saca a `id` del árbol y limpia todas las referencias que le apuntaban. */
export function eliminarPersona(arbol: Arbol, id: string): boolean {
  const antes = arbol.personas.length;
  arbol.personas = arbol.personas.filter((p) => p.id !== id);
  if (arbol.personas.length === antes) return false;
  for (const p of arbol.personas) {
    p.padres = p.padres.filter((x) => x !== id);
    p.parejas = p.parejas.filter((v) => v.personaId !== id);
  }
  return true;
}
