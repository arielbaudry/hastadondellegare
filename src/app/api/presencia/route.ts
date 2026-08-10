import { NextResponse } from "next/server";
import { anotar, leerArbol, mutarArbol } from "@/lib/store";
import { irse, latir, yaEstaba } from "@/lib/presencia";
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

  const nuevo = !yaEstaba(String(id ?? ""));
  const conectados = latir(String(id ?? ""), String(nombre ?? ""));
  let arbol = await leerArbol();

  // Se anota una entrada por sesión, no por latido: si no, la bitácora sería
  // una línea cada veinte segundos por persona y no serviría para nada.
  if (nuevo && nombre) {
    arbol = await mutarArbol((a) => anotar(a, { quien: String(nombre), accion: "entro" }));
  }
  return NextResponse.json(
    { conectados, rev: arbol.rev },
    { headers: { "Cache-Control": "no-store" } },
  );
}
