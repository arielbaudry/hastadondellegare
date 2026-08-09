import { NextResponse } from "next/server";
import { deshacer, registrar } from "@/lib/store";
import { bloquearSiNoPuedeEditar } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/** POST /api/deshacer — vuelve el árbol a como estaba antes del último cambio. */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoPuedeEditar(req);
  if (rechazo) return rechazo;

  const { autor } = await req.json().catch(() => ({ autor: undefined }));
  const arbol = await deshacer();

  if (!arbol) {
    return NextResponse.json(
      { error: "No hay ningún cambio anterior guardado para deshacer." },
      { status: 409 },
    );
  }

  await registrar({ accion: "deshacer", quien: autor, rev: arbol.rev });
  return NextResponse.json({ rev: arbol.rev, personas: arbol.personas });
}
