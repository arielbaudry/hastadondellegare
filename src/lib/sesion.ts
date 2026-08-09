import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Acceso por *magic link*: no hay contraseñas, se manda un enlace al correo
 * que la persona ya tiene cargado en su ficha del árbol.
 *
 * Reglas:
 *  - **Sólo entra quien tiene una ficha con correo cargado.** No hay registro.
 *  - `ADMIN_EMAIL` es el único administrador (puede borrar); el resto colabora:
 *    suma y corrige, pero no elimina.
 *
 * Todo va firmado y sin estado — ni el enlace ni la sesión se guardan en
 * ningún lado. Es lo que permite que funcione igual en Vercel, donde no hay
 * disco ni memoria compartida entre invocaciones.
 *
 * **El candado sólo se activa si está todo configurado** (`SESION_SECRETO` y
 * SMTP). Sin eso el sitio sigue abierto como hasta ahora: es a propósito, para
 * que un deploy a medio configurar no deje a la familia —ni a Ariel— afuera.
 */

export type Rol = "admin" | "colaborador";

export interface Sesion {
  email: string;
  rol: Rol;
}

const SECRETO = process.env.SESION_SECRETO ?? "";
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "ariel@baudry.com.ar").toLowerCase();

export const COOKIE = "hdll_sesion";
const VIDA_ENLACE = 30 * 60 * 1000; // media hora
const VIDA_SESION = 90 * 24 * 60 * 60 * 1000; // tres meses

export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** El acceso restringido se enciende solo cuando puede funcionar de verdad. */
export function accesoRestringido(): boolean {
  return Boolean(SECRETO) && smtpConfigurado();
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function rolDe(email: string): Rol {
  return normalizarEmail(email) === ADMIN_EMAIL ? "admin" : "colaborador";
}

// ------------------------------------------------------------------ firmado

function firmar(datos: string): string {
  return createHmac("sha256", SECRETO).update(datos).digest("base64url");
}

function crear(email: string, vida: number, proposito: string): string {
  const cuerpo = `${proposito}|${normalizarEmail(email)}|${Date.now() + vida}`;
  return `${Buffer.from(cuerpo).toString("base64url")}.${firmar(cuerpo)}`;
}

function abrir(token: string | undefined | null, proposito: string): string | null {
  if (!token || !SECRETO) return null;
  const [cuerpoB64, firma] = token.split(".");
  if (!cuerpoB64 || !firma) return null;

  const cuerpo = Buffer.from(cuerpoB64, "base64url").toString();
  const esperada = Buffer.from(firmar(cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  const [prop, email, vence] = cuerpo.split("|");
  if (prop !== proposito || !email) return null;
  if (Number(vence) < Date.now()) return null;
  return email;
}

/** Token del enlace que va por correo. Vive media hora. */
export function crearEnlace(email: string): string {
  return crear(email, VIDA_ENLACE, "enlace");
}

export function validarEnlace(token: string | null): string | null {
  return abrir(token, "enlace");
}

/** Cookie de sesión, una vez que el enlace se usó. */
export function crearSesion(email: string): string {
  return crear(email, VIDA_SESION, "sesion");
}

export function sesionDe(req: Request): Sesion | null {
  const cookies = req.headers.get("cookie") ?? "";
  const cruda = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);

  const email = abrir(cruda ? decodeURIComponent(cruda) : null, "sesion");
  return email ? { email, rol: rolDe(email) } : null;
}

export function cabeceraCookie(valor: string, vidaSegundos: number): string {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(valor)}; Path=/; Max-Age=${vidaSegundos}; HttpOnly; SameSite=Lax${seguro}`;
}

export const COOKIE_SESION_VIDA = VIDA_SESION / 1000;
