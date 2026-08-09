import { NextResponse } from "next/server";
import { mutarArbol, registrar } from "@/lib/store";
import { arbolDeEjemplo } from "@/lib/ejemplo";
import { bloquearSiNoEsAdmin } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/** POST /api/sembrar — { accion: "ejemplo" | "vaciar" }. Reinicia el contenido. */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoEsAdmin(req);
  if (rechazo) return rechazo;

  const { accion, autor } = await req.json().catch(() => ({ accion: null }));

  if (accion !== "ejemplo" && accion !== "vaciar") {
    return NextResponse.json({ error: 'accion debe ser "ejemplo" o "vaciar".' }, { status: 400 });
  }

  const arbol = await mutarArbol((a) => {
    a.personas = accion === "ejemplo" ? arbolDeEjemplo().personas : [];
    a.esEjemplo = accion === "ejemplo";
  });

  await registrar({ accion: `sembrar:${accion}`, quien: autor });
  return NextResponse.json({ rev: arbol.rev, personas: arbol.personas, esEjemplo: arbol.esEjemplo });
}
