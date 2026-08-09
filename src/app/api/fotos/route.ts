import { NextResponse } from "next/server";
import { guardarFoto, MAX_BYTES, tipoAceptado } from "@/lib/fotos";
import { bloquearSiNoPuedeEditar } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/** POST /api/fotos — multipart con el campo `foto`. Devuelve { url }. */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoPuedeEditar(req);
  if (rechazo) return rechazo;

  try {
    const form = await req.formData();
    const archivo = form.get("foto");

    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    }
    if (!tipoAceptado(archivo.type)) {
      return NextResponse.json({ error: "Sólo JPG, PNG o WEBP." }, { status: 400 });
    }
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera los 3 MB." }, { status: 400 });
    }

    return NextResponse.json({ url: await guardarFoto(archivo) });
  } catch (err) {
    console.error("[fotos POST]", err);
    return NextResponse.json({ error: "No se pudo subir la foto." }, { status: 500 });
  }
}
