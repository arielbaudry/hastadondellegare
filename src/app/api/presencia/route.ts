import { NextResponse } from "next/server";
import { leerArbol } from "@/lib/store";
import { irse, latir } from "@/lib/presencia";
import { bloquearSiNoPuedeVer } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/**
 * POST /api/presencia — { id, nombre, salir? }
 *
 * Late cada tanto y devuelve quiénes están mirando, más el `rev` del árbol.
 * Ese `rev` es lo que le permite al navegador darse cuenta de que otro pariente
 * guardó algo y refrescar solo, sin recargar la página.
 */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoPuedeVer(req);
  if (rechazo) return rechazo;

  const { id, nombre, salir } = await req.json().catch(() => ({ id: "", nombre: "" }));

  if (salir) {
    irse(String(id ?? ""));
    return NextResponse.json({ ok: true });
  }

  const conectados = latir(String(id ?? ""), String(nombre ?? ""));
  const arbol = await leerArbol();
  return NextResponse.json(
    { conectados, rev: arbol.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
