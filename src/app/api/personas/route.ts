import { NextResponse } from "next/server";
import { mutarArbol, registrar } from "@/lib/store";
import { ErrorDeDatos, normalizar, sanearPersona } from "@/lib/validar";
import { nombreCompleto } from "@/lib/tree";
import { bloquearSiNoPuedeEditar } from "@/lib/permisos";
import type { Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/personas — alta. El cuerpo es { autor, persona }. */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoPuedeEditar(req);
  if (rechazo) return rechazo;

  try {
    const cuerpo = await req.json();
    let creada: Persona | null = null;

    const arbol = await mutarArbol((a) => {
      creada = sanearPersona(cuerpo.persona, null, cuerpo.autor);
      a.personas.push(creada);
      // Cargar a alguien deja de ser "el ejemplo" apenas hay data propia.
      if (!creada.creadoPor || creada.creadoPor !== "ejemplo") a.esEjemplo = false;
      normalizar(a);
    });

    await registrar({ accion: "alta", id: creada!.id, quien: cuerpo.autor, nombre: nombreCompleto(creada!) });
    return NextResponse.json({ persona: creada, rev: arbol.rev, personas: arbol.personas });
  } catch (err) {
    if (err instanceof ErrorDeDatos) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[personas POST]", err);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
