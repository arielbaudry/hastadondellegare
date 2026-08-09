import { NextResponse } from "next/server";
import { accesoRestringido, sesionDe, type Sesion } from "./sesion";

/**
 * Quién puede hacer qué.
 *
 * Con el acceso por enlace configurado (ver `sesion.ts`):
 *  - **admin** (`ADMIN_EMAIL`): todo, incluido borrar.
 *  - **colaborador** (cualquiera con ficha y correo cargado): sumar y corregir.
 *    No borra: un dato mal cargado se arregla, uno borrado no vuelve.
 *  - **sin sesión**: nada, ni siquiera leer. El árbol tiene teléfonos y
 *    direcciones de la familia; no es material para dejar suelto en internet.
 *
 * Sin configurar, el sitio queda como estaba —abierto para leer y editar— y
 * las operaciones destructivas siguen detrás de `ADMIN_CLAVE`. Es el default
 * seguro: un deploy a medio configurar no deja a nadie afuera ni habilita
 * borrar por accidente.
 */

export const CLAVE_ADMIN = process.env.ADMIN_CLAVE ?? "";
export const CABECERA_CLAVE = "x-clave-admin";

export function hayClaveConfigurada(): boolean {
  return CLAVE_ADMIN.length > 0;
}

/** Comparación en tiempo constante, para no filtrar la clave por los tiempos. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function claveValida(clave: string | null | undefined): boolean {
  return hayClaveConfigurada() && !!clave && iguales(clave, CLAVE_ADMIN);
}

export interface Permisos {
  puedeVer: boolean;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  /** Está encendido el acceso por enlace. */
  restringido: boolean;
  sesion: Sesion | null;
}

export function permisosDe(req: Request): Permisos {
  const restringido = accesoRestringido();
  const sesion = restringido ? sesionDe(req) : null;

  if (!restringido) {
    return {
      puedeVer: true,
      puedeEditar: true,
      puedeBorrar: claveValida(req.headers.get(CABECERA_CLAVE)),
      restringido: false,
      sesion: null,
    };
  }

  return {
    puedeVer: !!sesion,
    puedeEditar: !!sesion,
    puedeBorrar: sesion?.rol === "admin",
    restringido: true,
    sesion,
  };
}

function rechazar(mensaje: string, estado: number): NextResponse {
  return NextResponse.json({ error: mensaje }, { status: estado });
}

/** Para leer el árbol. */
export function bloquearSiNoPuedeVer(req: Request): NextResponse | null {
  return permisosDe(req).puedeVer
    ? null
    : rechazar("Pedí tu enlace de acceso para ver el árbol.", 401);
}

/** Para sumar o corregir. */
export function bloquearSiNoPuedeEditar(req: Request): NextResponse | null {
  return permisosDe(req).puedeEditar
    ? null
    : rechazar("Pedí tu enlace de acceso para cargar o corregir.", 401);
}

/** Para borrar, importar o reemplazar el árbol entero. */
export function bloquearSiNoEsAdmin(req: Request): NextResponse | null {
  const p = permisosDe(req);
  if (p.puedeBorrar) return null;
  if (p.restringido) {
    return rechazar("Sólo el administrador del árbol puede eliminar. Se puede corregir cualquier ficha.", 403);
  }
  if (!hayClaveConfigurada()) {
    return rechazar(
      "Borrar está deshabilitado en este árbol. Se puede corregir cualquier ficha, pero no eliminar.",
      403,
    );
  }
  return rechazar("Hace falta la clave de administración para esta acción.", 403);
}
