"use client";

import type { Arbol, Persona, PersonaEntrada } from "./types";

/** Estado del almacenamiento que informa /api/arbol. */
export interface EstadoAlmacenamiento {
  driver: "fs" | "redis";
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
  const res = await fetch("/api/arbol", { cache: "no-store" });
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

export function editarPersona(id: string, persona: Partial<PersonaEntrada>, autor: string) {
  return pedir<{ persona: Persona; personas: Persona[] }>(`/api/personas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona, autor }),
  });
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

export async function subirFoto(archivo: Blob): Promise<string> {
  const form = new FormData();
  form.append("foto", archivo, "foto.jpg");
  const res = await fetch("/api/fotos", { method: "POST", body: form });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error ?? "No se pudo subir la foto.");
  return datos.url as string;
}
