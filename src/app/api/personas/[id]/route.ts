import { NextResponse } from "next/server";
import { mutarArbol, registrar } from "@/lib/store";
import { eliminarPersona, ErrorDeDatos, normalizar, sanearPersona } from "@/lib/validar";
import { bloquearSiNoEsAdmin, bloquearSiNoPuedeEditar } from "@/lib/permisos";
import type { Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/personas/:id — edición. Cuerpo { autor, persona }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const rechazo = bloquearSiNoPuedeEditar(req);
  if (rechazo) return rechazo;

  const { id } = await params;
  try {
    const cuerpo = await req.json();
    let noExiste = false;
    let actualizada: Persona | null = null;

    const arbol = await mutarArbol((a) => {
      const i = a.personas.findIndex((p) => p.id === id);
      if (i === -1) {
        noExiste = true;
        return;
      }
      // Se parte de la persona guardada: lo que el cliente no manda, se conserva.
      actualizada = sanearPersona(
        { ...a.personas[i], ...cuerpo.persona },
        a.personas[i],
        cuerpo.autor,
      );
      a.personas[i] = actualizada;
      a.esEjemplo = false;
      normalizar(a);
    });

    if (noExiste) return NextResponse.json({ error: "No existe esa persona." }, { status: 404 });

    await registrar({ accion: "edicion", id, quien: cuerpo.autor });
    return NextResponse.json({ persona: actualizada, rev: arbol.rev, personas: arbol.personas });
  } catch (err) {
    if (err instanceof ErrorDeDatos) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[personas PATCH]", err);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}

/** DELETE /api/personas/:id — baja, limpiando los vínculos que la apuntaban. */
export async function DELETE(req: Request, { params }: Ctx) {
  const rechazo = bloquearSiNoEsAdmin(req);
  if (rechazo) return rechazo;

  const { id } = await params;
  const autor = new URL(req.url).searchParams.get("autor") ?? undefined;
  let borrada = false;

  const arbol = await mutarArbol((a) => {
    borrada = eliminarPersona(a, id);
    if (borrada) normalizar(a);
  });

  if (!borrada) return NextResponse.json({ error: "No existe esa persona." }, { status: 404 });

  await registrar({ accion: "baja", id, quien: autor });
  return NextResponse.json({ ok: true, rev: arbol.rev, personas: arbol.personas });
}
