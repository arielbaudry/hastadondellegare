import { NextResponse } from "next/server";
import { leerArbol, registrar } from "@/lib/store";
import {
  cabeceraCookie,
  COOKIE_SESION_VIDA,
  crearSesion,
  normalizarEmail,
  validarEnlace,
} from "@/lib/sesion";

export const dynamic = "force-dynamic";

/** GET /api/acceso/entrar?t=… — cambia el enlace del correo por una sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = validarEnlace(url.searchParams.get("t"));

  if (!email) {
    return NextResponse.redirect(new URL("/?acceso=vencido", url.origin));
  }

  // La firma sola no alcanza: el correo tiene que seguir estando en el árbol.
  // Si a alguien lo sacaron, su enlace deja de servir en el acto.
  const arbol = await leerArbol();
  const sigue = arbol.personas.some((p) => p.email && normalizarEmail(p.email) === email);
  if (!sigue) {
    await registrar({ accion: "acceso:rechazado", email });
    return NextResponse.redirect(new URL("/?acceso=vencido", url.origin));
  }

  await registrar({ accion: "acceso:entro", email });
  const respuesta = NextResponse.redirect(new URL("/", url.origin));
  respuesta.headers.set("Set-Cookie", cabeceraCookie(crearSesion(email), COOKIE_SESION_VIDA));
  return respuesta;
}
