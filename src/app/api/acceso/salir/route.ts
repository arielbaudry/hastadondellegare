import { NextResponse } from "next/server";
import { cabeceraCookie } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/** POST /api/acceso/salir — cierra la sesión en este navegador. */
export async function POST() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.headers.set("Set-Cookie", cabeceraCookie("", 0));
  return respuesta;
}
