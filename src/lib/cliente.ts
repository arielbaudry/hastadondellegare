"use client";

import type { Arbol, Movimiento, Persona, PersonaEntrada } from "./types";

export type { Movimiento };

/** Estado del almacenamiento que informa /api/arbol. */
export interface EstadoAlmacenamiento {
  driver: string;
  persistente: boolean;
  advertencia: string | null;
}

export interface Permisos {
  puedeVer: boolean;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  restringido: boolean;
}

export interface Sesion {
  email: string;
  rol: "admin" | "colaborador";
}

export interface RespuestaArbol extends Arbol {
  almacenamiento: EstadoAlmacenamiento | null;
  permisos: Permisos;
  sesion: Sesion | null;
  contacto: { email: string; telefono: string };
  espejo: { principal: string } | null;
}

const CLAVE_ADMIN = "hdll:clave";

/** La clave de administración vive sólo en este navegador. */
export function leerClaveAdmin(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CLAVE_ADMIN) ?? "";
}

export function guardarClaveAdmin(clave: string): void {
  if (clave) window.localStorage.setItem(CLAVE_ADMIN, clave);
  else window.localStorage.removeItem(CLAVE_ADMIN);
}

const CLAVE_AUTOR = "hdll:autor";
const CLAVE_FOCO = "hdll:foco";

/**
 * Sin login, la autoría es lo que cada quien declara una vez y queda en su
 * navegador. No es identidad: es para saber quién cargó qué cuando después
 * migremos a accesos por magic link.
 */
export function leerAutor(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CLAVE_AUTOR) ?? "";
}

export function guardarAutor(nombre: string): void {
  window.localStorage.setItem(CLAVE_AUTOR, nombre.trim());
}

const CLAVE_MI_FICHA = "hdll:miFicha";

/** Cuál de las personas del árbol es quien está usando este navegador. */
export function leerMiFicha(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_MI_FICHA);
}

export function guardarMiFicha(id: string | null): void {
  if (id) window.localStorage.setItem(CLAVE_MI_FICHA, id);
  else window.localStorage.removeItem(CLAVE_MI_FICHA);
}

export function leerFocoGuardado(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_FOCO);
}

export function guardarFoco(id: string): void {
  window.localStorage.setItem(CLAVE_FOCO, id);
}

async function pedir<T>(url: string, opciones?: RequestInit): Promise<T> {
  const clave = leerClaveAdmin();
  const res = await fetch(url, {
    cache: "no-store",
    ...opciones,
    headers: { ...(opciones?.headers ?? {}), ...(clave ? { "x-clave-admin": clave } : {}) },
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? `Error ${res.status}`);
  return datos as T;
}

/**
 * Trae el árbol. El 401 no es un error a mostrar: es "todavía no entraste", y
 * la respuesta ya viene con lo necesario para pintar la pantalla de acceso.
 */
export async function traerArbol(): Promise<RespuestaArbol> {
  // La clave viaja también acá: es esta respuesta la que dice si se puede
  // borrar. Sin la cabecera, desbloquear en Ajustes siempre fallaba.
  const clave = leerClaveAdmin();
  const res = await fetch("/api/arbol", {
    cache: "no-store",
    headers: clave ? { "x-clave-admin": clave } : {},
  });
  // El cuerpo puede venir vacío si el servidor se cae de verdad: parsear a
  // ciegas mostraba "Unexpected end of JSON input" en vez del problema real.
  const crudo = await res.text();
  let datos: Partial<RespuestaArbol> & { error?: string } = {};
  try {
    datos = crudo ? JSON.parse(crudo) : {};
  } catch {
    throw new Error(`El servidor respondió algo que no es JSON (HTTP ${res.status}).`);
  }
  if (!res.ok && res.status !== 401) {
    throw new Error(datos.error ?? `No se pudo cargar el árbol (HTTP ${res.status}).`);
  }
  return datos as RespuestaArbol;
}

export async function cerrarSesion(): Promise<void> {
  await fetch("/api/acceso/salir", { method: "POST" });
}

export function crearPersona(persona: PersonaEntrada, autor: string) {
  return pedir<{ persona: Persona; personas: Persona[] }>("/api/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona, autor }),
  });
}

export class ConflictoDeEdicion extends Error {
  constructor(mensaje: string, readonly persona: Persona) {
    super(mensaje);
  }
}

export async function editarPersona(
  id: string,
  persona: Partial<PersonaEntrada>,
  autor: string,
) {
  const res = await fetch(`/api/personas/${id}`, {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(leerClaveAdmin() ? { "x-clave-admin": leerClaveAdmin() } : {}),
    },
    body: JSON.stringify({ persona, autor }),
  });
  const datos = await res.json().catch(() => ({}));
  if (res.status === 409 && datos.conflicto) {
    throw new ConflictoDeEdicion(datos.error, datos.persona as Persona);
  }
  if (!res.ok) throw new Error(datos.error ?? `Error ${res.status}`);
  return datos as { persona: Persona; personas: Persona[] };
}

export function borrarPersona(id: string, autor: string) {
  return pedir<{ personas: Persona[] }>(
    `/api/personas/${id}?autor=${encodeURIComponent(autor)}`,
    { method: "DELETE" },
  );
}

export function sembrar(accion: "ejemplo" | "vaciar", autor: string) {
  return pedir<{ personas: Persona[]; esEjemplo: boolean }>("/api/sembrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion, autor }),
  });
}

export function deshacerCambio(autor: string) {
  return pedir<{ personas: Persona[] }>("/api/deshacer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autor }),
  });
}

/** Identidad de este navegador, sólo para contar quién está mirando. */
const CLAVE_VISITA = "hdll:visita";

export function idDeVisita(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CLAVE_VISITA);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(CLAVE_VISITA, id);
  }
  return id;
}

export function latir(nombre: string) {
  return pedir<{ conectados: string[]; rev: number }>("/api/presencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idDeVisita(), nombre }),
  });
}

export async function subirFoto(archivo: Blob): Promise<string> {
  const form = new FormData();
  form.append("foto", archivo, "foto.jpg");
  const res = await fetch("/api/fotos", { method: "POST", body: form });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? "No se pudo subir la foto.");
  return datos.url as string;
}
